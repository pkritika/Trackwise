# TrackWise

TrackWise is a **production-grade** expense tracking application that extracts and analyzes transactions from bank statement PDFs using advanced parsing techniques and AI-powered categorization.

## Features

### 🎯 Production-Grade PDF Parser
- **Intelligent Page Scoring**: Automatically identifies pages containing transactions
- **Multi-Layer Extraction**:
  - Layer 1: Table extraction with heuristic column detection
  - Layer 2: Regex-based text parsing
  - Layer 3: OCR fallback for scanned PDFs (optional)
- **Cross-Page Merging**: Handles transactions split across page boundaries
- **Smart Validation**: Automatic deduplication and data cleaning
- **Robust Error Handling**: Clear error messages and troubleshooting tips

### 📊 Analytics Dashboard
- View all transactions in a clean, formatted table
- Transaction statistics (total spent, received, net change)
- Top expenses and income breakdown
- Export to CSV for further analysis

### 🤖 AI-Powered Categorization
- **Automatic categorization** using Claude (Anthropic's AI)
- **10 smart categories**: Food & Dining, Transport, Shopping, Entertainment, Utilities, Health, Rent/Housing, Income, Subscriptions, Other
- **Batch processing**: Efficiently processes 50 transactions per API call
- **Few-shot learning**: Uses carefully crafted examples for accurate categorization
- **Robust error handling**: Falls back to "Other" if JSON parsing fails
- **Visual analytics**: Interactive pie and bar charts showing spending by category
- **Category filtering**: Filter transactions by one or more categories
- **Export categorized data**: Download CSV with category column

### 🔮 Coming Soon
- Spending trends over time
- Budget tracking and alerts
- Multi-statement comparison

## Setup Instructions

### 1. Create a Virtual Environment

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On macOS/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

**Optional - For OCR Support (scanned PDFs):**
```bash
pip install pdf2image pytesseract
```

### 3. Run the Application

```bash
streamlit run app.py
```

The application will open in your default web browser at `http://localhost:8501`.

## Using AI Categorization

To use the AI-powered categorization feature:

1. **Get an Anthropic API Key**:
   - Visit https://console.anthropic.com/
   - Sign up or log in
   - Create an API key from the dashboard
   - Copy the key (starts with `sk-ant-...`)

2. **Categorize Your Transactions**:
   - Upload and parse your bank statement PDF
   - Enter your API key in the "Anthropic API Key" field
   - Click "🎯 Categorize Transactions"
   - Wait for Claude to process your transactions (batches of 50)
   - View categorized results with interactive visualizations

3. **Explore Results**:
   - View spending distribution in pie chart
   - Analyze category totals in bar chart
   - Filter transactions by category
   - Download categorized CSV for further analysis

**Note**: The categorization feature uses Claude API which has associated costs. See [Anthropic's pricing](https://www.anthropic.com/pricing) for details.

## How It Works

### PDF Parsing Pipeline

1. **Page Scoring** - Each page is scored based on:
   - Presence of date patterns (+2)
   - Presence of dollar amounts (+2)
   - Transaction keywords like "debit", "credit" (+3)
   - Legal keywords like "terms", "privacy" (-3)
   - Table rows found (+1 per 2 rows)
   - Only pages scoring ≥3 are processed

2. **Three-Layer Extraction** - For each high-scoring page:
   - **Layer 1**: Extract from PDF tables using column heuristics
   - **Layer 2**: Parse text line-by-line with regex patterns
   - **Layer 3**: OCR fallback for scanned documents (if installed)

3. **Cross-Page Merging** - Combines split transactions across page boundaries

4. **Validation & Cleaning**:
   - Remove zero/invalid amounts
   - Remove invalid descriptions
   - Deduplicate exact matches
   - Remove header rows
   - Normalize amounts (handle $, commas, parentheses as negative)

5. **Output** - Clean DataFrame with:
   - `date` (string, original format)
   - `description` (string, cleaned)
   - `amount` (float, negative = expense, positive = income)

### AI Categorization Pipeline

1. **Batch Processing** - Transactions are processed in batches of 50:
   - Reduces API calls and costs
   - Includes 0.5s delay between batches for rate limiting
   - Maintains order and completeness

2. **Smart Prompting** - Each batch is sent to Claude with:
   - System prompt defining all 10 categories with examples
   - Few-shot examples showing correct categorization
   - Transaction data: date, description, amount
   - Instructions to return JSON array

3. **Category Matching**:
   - Claude analyzes merchant names and transaction patterns
   - Considers amount (positive = likely Income)
   - Returns category for each transaction
   - Temperature = 0 for consistent, deterministic results

4. **Error Handling**:
   - Parse JSON response, handling markdown code blocks
   - Validate categories against allowed list
   - Case-insensitive matching with fallback
   - Default to "Other" for any parsing errors or API failures

5. **Output** - Enhanced DataFrame with:
   - Original columns: date, description, amount
   - New column: `category` (one of 10 predefined categories)
   - Ready for visualization and analysis

## Supported PDF Formats

✅ Digital bank statements (PDF with selectable text)
✅ Statements with tables
✅ Text-based statements without tables
✅ Multi-page statements
⚠️ Scanned PDFs (requires OCR dependencies)

## Troubleshooting

If parsing fails:
1. Ensure your PDF is a digital statement (not a scanned image)
2. Check the "Parser Debug Information" expander for details
3. Try downloading a fresh copy from your bank
4. Consider CSV export if available from your bank
5. For scanned PDFs, install OCR dependencies

## Project Structure

```
Trackwise/
├── app.py              # Streamlit UI application
├── pdf_parser.py       # Production-grade PDF parser
├── categorizer.py      # AI categorization (placeholder)
├── requirements.txt    # Python dependencies
└── README.md          # This file
```

## Requirements

- Python 3.7 or higher
- See `requirements.txt` for package dependencies

## Technology Stack

- **PDF Processing**: pdfplumber
- **Data Processing**: pandas
- **UI Framework**: Streamlit
- **AI (Coming Soon)**: Anthropic Claude
- **Optional OCR**: pdf2image, pytesseract
