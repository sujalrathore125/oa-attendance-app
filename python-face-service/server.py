from flask import Flask, request, jsonify
from face_engine import extract_face_embedding, verify_face

app = Flask(__name__)

@app.route("/register", methods=["POST"])
def register():
    image = request.files["image"].read()
    result = extract_face_embedding(image)
    return jsonify(result)

@app.route("/verify", methods=["POST"])
def verify():
    image = request.files["image"].read()
    embedding = request.form["embedding"]
    import json
    embedding = json.loads(embedding)

    result = verify_face(image, embedding)
    return jsonify(result)

if __name__ == "__main__":
    app.run(host="localhost", port=8000)