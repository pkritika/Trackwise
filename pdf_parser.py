import re
import pdfplumber
import pandas as pd


# these are the patterns used throughout
DATE_RE = re.compile(
    r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|'
    r'(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:,?\s*\d{4})?)\b',
    re.IGNORECASE
)
AMOUNT_RE = re.compile(r'\(?\$?\s*-?\d{1,3}(?:,\d{3})*\.?\d{0,2}\)?')


def extract_transactions(pdf_path: str) -> pd.DataFrame:
    all_transactions = []

    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            if not is_transaction_page(page):
                continue

            # try table extraction first, fall back to raw text
            txns = extract_from_table(page)
            if len(txns) < 3:
                txns = extract_from_text(page)

            if txns:
                print(f"page {i+1}: found {len(txns)} transactions")
                all_transactions.extend(txns)

    if not all_transactions:
        raise ValueError(
            "No transactions found. Make sure this is a digital (not scanned) bank statement PDF."
        )

    df = clean_transactions(all_transactions)

    if df.empty:
        raise ValueError("Transactions were found but none passed validation. Check the PDF format.")

    return df


def is_transaction_page(page) -> bool:  
    text = page.extract_text() or ""      #giving extracted text, but if that comes back as None or empty, it just gives an empty string instead.
    text_lower = text.lower()

    dates = len(DATE_RE.findall(text))
    print(f"Found {dates} date-like patterns on page.") 
    amounts = len(AMOUNT_RE.findall(text))
    print(f"Found {amounts} amount-like patterns on page.")     

    # if a page has several dates and amounts, it's probably a transaction page
    # also bail early if it's a legal/terms page — those also have numbers sometimes
    legal_words = ("terms and conditions", "privacy policy", "disclosure", "agreement")
    if any(w in text_lower for w in legal_words):
        return False

    return dates >= 1 and amounts >= 1


def extract_from_table(page) -> list:  # try to pull transactions out of a proper pdf table.
    transactions = []

    for table in page.extract_tables() or []:
        if not table or len(table) < 2:
            continue

        # figure out which columns are date / desc / amount by peeking at the data
        date_col, desc_col, amount_col = _guess_columns(table)
        if date_col is None or amount_col is None:
            continue

        for row in table[1:]:  # skip header row
            if len(row) <= max(filter(None, [date_col, amount_col])):
                continue

            date = str(row[date_col] or "").strip()
            amount = str(row[amount_col] or "").strip()
            desc = str(row[desc_col] or "").strip() if desc_col is not None else ""

            if _looks_like_date(date) and _looks_like_amount(amount):
                transactions.append({"date": date, "description": desc, "amount": amount})
    return transactions


def _looks_like_date(text: str) -> bool:    #helper
    return bool(re.match(
        r'^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|'
        r'(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2})',
        text, re.IGNORECASE
    ))


def _looks_like_amount(text: str) -> bool:
    return bool(re.match(r'^\(?\$?\s*-?\d{1,3}(?:,\d{3})*\.?\d{0,2}\)?$', text.strip()))

def extract_from_text(page) -> list:
    """fallback: parse raw text lines with regex when there's no clean table."""
    transactions = []
    text = page.extract_text() or ""

    for line in text.splitlines():
        line = line.strip()
        if len(line) < 8:
            continue

        date_match = DATE_RE.search(line)
        amount_matches = AMOUNT_RE.findall(line)

        if not date_match or not amount_matches:
            continue

        date = date_match.group(0)
        amount = amount_matches[-1]  # last number is usually the transaction amount
        desc = line[date_match.end():line.rfind(amount)].strip()

        transactions.append({"date": date, "description": desc, "amount": amount})
    print(f"Extracted {len(transactions)} transactions from text.")
    return transactions


def clean_transactions(raw: list) -> pd.DataFrame:
    if not raw:
        return pd.DataFrame(columns=["date", "description", "amount"])

    df = pd.DataFrame(raw)
    df["amount"] = df["amount"].apply(normalize_amount)
    df = df.dropna(subset=["amount"])
    df = df[df["amount"] != 0]

    df["description"] = df["description"].str.strip().str.replace(r"\s+", " ", regex=True)
    df = df[df["description"].str.len() >= 2]

    # drop obvious header rows that snuck through
    header_words = {"date", "description", "amount", "balance", "transaction"}
    df = df[~df["description"].str.lower().isin(header_words)]

    df = df.drop_duplicates(subset=["date", "description", "amount"])
    return df[["date", "description", "amount"]].reset_index(drop=True)




def _guess_columns(table): # look at the first few rows and score each column for date/amount/desc content.
    n_cols = max(len(row) for row in table)
    date_score = [0] * n_cols
    amount_score = [0] * n_cols
    desc_score = [0] * n_cols

    for row in table[1:6]:  # sample up to 5 data rows
        for i, cell in enumerate(row):
            if i >= n_cols:
                break
            val = str(cell or "").strip()
            if _looks_like_date(val):
                date_score[i] += 1
            elif _looks_like_amount(val):
                amount_score[i] += 1
            elif len(val) > 5:
                desc_score[i] += 1

    date_col = date_score.index(max(date_score)) if max(date_score) else None
    amount_col = amount_score.index(max(amount_score)) if max(amount_score) else None
    desc_col = desc_score.index(max(desc_score)) if max(desc_score) else None
    print(f"Column scores - Date: {date_score}, Amount: {amount_score}, Desc: {desc_score}")
    return date_col, desc_col, amount_col




def normalize_amount(raw: str):
    """turn '$1,234.56' or '(50.00)' into a float. returns None if it can't."""
    raw = raw.strip()
    negative = raw.startswith("(") and raw.endswith(")")
    cleaned = raw.strip("()").replace("$", "").replace(",", "").replace(" ", "")
    try:
        val = float(cleaned)
        return -abs(val) if negative else val
    except ValueError:
        return None











