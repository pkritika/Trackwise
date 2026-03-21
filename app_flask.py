"""
TrackWise Flask Application
A beautiful expense tracking app with AI categorization
"""

from flask import Flask, render_template, request, jsonify, session
import os
import tempfile
import json
import uuid
from pathlib import Path
from werkzeug.utils import secure_filename

from pdf_parser import extract_transactions
from categorizer import categorize_transactions, get_category_summary

app = Flask(__name__)
app.secret_key = os.urandom(24)
app.config['UPLOAD_FOLDER'] = tempfile.gettempdir()
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB per file

ALLOWED_EXTENSIONS = {'pdf'}

# Directory to store server-side session data (JSON files)
DATA_DIR = Path(tempfile.gettempdir()) / 'trackwise_data'
DATA_DIR.mkdir(exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ──────────────────────────────────────────────────────────────────────────────
# SERVER-SIDE DATA HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _get_data_path() -> Path:
    """
    Return the server-side JSON file path for the current session.
    Creates a new unique file if the session doesn't have one yet.
    """
    if 'data_id' not in session:
        session['data_id'] = str(uuid.uuid4())
    return DATA_DIR / f"{session['data_id']}.json"


def _save_data(transactions: list, categorized: bool):
    """Persist transaction data to a server-side JSON file."""
    path = _get_data_path()
    with open(path, 'w') as f:
        json.dump({'transactions': transactions, 'categorized': categorized}, f)


def _load_data() -> dict:
    """Load transaction data from the server-side JSON file."""
    if 'data_id' not in session:
        return {'transactions': [], 'categorized': False}
    path = _get_data_path()
    if not path.exists():
        return {'transactions': [], 'categorized': False}
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {'transactions': [], 'categorized': False}


# ══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/')
def index():
    """Landing page with hero and features"""
    return render_template('index.html')


@app.route('/dashboard')
def dashboard():
    """Dashboard page showing transactions and analytics"""
    data = _load_data()
    return render_template('dashboard.html',
                           transactions=data['transactions'],
                           categorized=data['categorized'])


# ══════════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/upload', methods=['POST'])
def upload_pdf():
    """Upload and parse a single PDF bank statement, appending to session data"""

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Only PDF files are allowed'}), 400

    filepath = None
    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        df = extract_transactions(filepath)
        os.unlink(filepath)
        filepath = None

        new_transactions = df.to_dict('records')

        # Append to any existing session transactions
        existing = _load_data()
        merged = existing.get('transactions', []) + new_transactions
        _save_data(merged, categorized=False)

        return jsonify({
            'success': True,
            'count': len(new_transactions),
            'total': len(merged)
        })

    except ValueError as e:
        if filepath and os.path.exists(filepath):
            os.unlink(filepath)
        return jsonify({'error': str(e)}), 400

    except Exception as e:
        if filepath and os.path.exists(filepath):
            os.unlink(filepath)
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


@app.route('/api/categorize', methods=['POST'])
def categorize():
    """Categorize transactions using Claude AI"""

    # Read the API key from the server environment — never exposed to the client
    api_key = os.environ.get('ANTHROPIC_API_KEY', '').strip()

    if not api_key:
        return jsonify({'error': 'Server is missing the ANTHROPIC_API_KEY environment variable. Please set it and restart the server.'}), 500

    stored = _load_data()
    transactions = stored.get('transactions', [])

    if not transactions:
        return jsonify({'error': 'No transactions found. Upload a PDF first.'}), 400

    try:
        import pandas as pd
        df = pd.DataFrame(transactions)

        # Categorize with Claude
        df_categorized = categorize_transactions(df, api_key)

        # Convert back to list of dicts
        categorized_transactions = df_categorized.to_dict('records')

        # Persist categorized data
        _save_data(categorized_transactions, categorized=True)

        # Get summary
        summary = get_category_summary(df_categorized)
        summary_data = summary.to_dict('records') if not summary.empty else []

        return jsonify({
            'success': True,
            'transactions': categorized_transactions,
            'summary': summary_data
        })

    except Exception as e:
        return jsonify({'error': f'Categorization failed: {str(e)}'}), 500


@app.route('/api/data')
def get_data():
    """Get current session data"""
    stored = _load_data()
    transactions = stored.get('transactions', [])
    categorized = stored.get('categorized', False)

    # Calculate summary if categorized
    summary = None
    if categorized and transactions:
        import pandas as pd
        df = pd.DataFrame(transactions)
        summary_df = get_category_summary(df)
        summary = summary_df.to_dict('records') if not summary_df.empty else []

    return jsonify({
        'transactions': transactions,
        'categorized': categorized,
        'summary': summary,
        'count': len(transactions)
    })


@app.route('/api/export')
def export_csv():
    """Export transactions as CSV"""
    stored = _load_data()
    transactions = stored.get('transactions', [])

    if not transactions:
        return jsonify({'error': 'No transactions to export'}), 400

    import pandas as pd
    from io import StringIO

    df = pd.DataFrame(transactions)
    csv_buffer = StringIO()
    df.to_csv(csv_buffer, index=False)

    return csv_buffer.getvalue(), 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=trackwise_transactions.csv'
    }


# ══════════════════════════════════════════════════════════════════════════════
# ERROR HANDLERS
# ══════════════════════════════════════════════════════════════════════════════

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File too large. Maximum size is 16MB.'}), 413


@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404


# ══════════════════════════════════════════════════════════════════════════════
# RUN
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    app.run(debug=True, port=5000)
