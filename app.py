from flask import Flask, request, render_template, jsonify
import requests
import json
import os
import time

app = Flask(__name__)
chat_history = []

# Đảm bảo các thư mục tồn tại
os.makedirs('templates', exist_ok=True)
os.makedirs('static', exist_ok=True)

@app.route("/", methods=["GET"])
def home():
    return render_template("index.html", history=chat_history)

@app.route("/send", methods=["POST"])
def send_message():
    message = request.form.get("message", "")
    if not message.strip():
        return jsonify({"error": "Tin nhắn trống"}), 400
    
    chat_history.append({"role": "user", "content": message})
    
    try:
        # Ghi lại thời gian bắt đầu
        start_time = time.time()
        
        # Gọi API LLM
        response = requests.post(
            "http://localhost:8080/v1/chat/completions",
            json={
                "model": "gemma-3-1b-it-rk3588-1.2.0",
                "messages": chat_history
            }
        )
        
        # Tính thời gian phản hồi
        end_time = time.time()
        response_time = round(end_time - start_time, 2)
        
        response_data = response.json()
        ai_response = response_data["choices"][0]["message"]["content"]
        
        # Thêm phản hồi vào lịch sử chat kèm thời gian phản hồi
        chat_history.append({
            "role": "assistant", 
            "content": ai_response,
            "response_time": response_time
        })
        
        return jsonify({"response": ai_response, "response_time": response_time})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
