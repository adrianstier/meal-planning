from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/api/test')
def test():
    return jsonify({'status': 'ok', 'message': 'API is working'})

handler = app
