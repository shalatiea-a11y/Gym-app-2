from http.server import BaseHTTPRequestHandler
import json
import os
import anthropic

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        body = json.loads(post_data)

        company = body.get('company', '')
        period = body.get('period', '')
        revenue = body.get('revenue', 0)
        cogs = body.get('cogs', 0)
        operating_expenses = body.get('operating_expenses', 0)

        financial_summary = f"""
Company: {company}
Period: {period}
Revenue: {revenue} SEK
Cost of Goods Sold: {cogs} SEK
Operating Expenses: {operating_expenses} SEK
"""

        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=500,
            system="You are a financial reporting assistant. Respond with valid JSON only. No markdown code blocks, no extra text before or after. Use this exact structure: {\"company\": \"\", \"period\": \"\", \"revenue\": 0, \"cogs\": 0, \"operating_expenses\": 0, \"net_profit\": 0, \"summary\": \"\"}",
            messages=[
                {"role": "user", "content": f"Extract and summarize this financial data:\n{financial_summary}"}
            ]
        )

        raw_text = message.content[0].text.strip()

        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        result = json.loads(raw_text)

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
