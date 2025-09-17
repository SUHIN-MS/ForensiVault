import { useState } from "react";
import API from "../api";

export default function FileUpload({ onUpload }) {
  const [file, setFile] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await API.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Uploaded successfully");
      onUpload(res.data.evidence);
    } catch (err) {
      alert("Upload failed");
    }
  };

  return (
    <div className="p-4 border rounded mb-4">
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload} className="ml-2 bg-green-600 text-white px-4 py-1 rounded">
        Upload
      </button>
    </div>
  );
}
