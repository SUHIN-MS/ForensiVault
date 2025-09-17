import React, { useEffect, useState } from "react";
import axios from "axios";

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [file, setFile] = useState(null);

  const token = localStorage.getItem("token");
  const config = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    // Fetch logs (also used to display uploaded files)
    axios
      .get("http://localhost:3000/logs", config)
      .then((res) => setLogs(res.data))
      .catch((err) => console.log(err));
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert("Select a file first!");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post("http://localhost:3000/upload", formData, config);
      alert("File uploaded!");
      setLogs([...logs, res.data.log]); // add new log
    } catch (err) {
      console.log(err);
      alert("Upload failed.");
    }
  };

  const handleVerify = async (evidenceId) => {
    try {
      const res = await axios.post(`http://localhost:3000/verify/${evidenceId}`, {}, config);
      alert(res.data.match ? "File is untampered ✅" : "File has been altered ❌");
    } catch (err) {
      console.log(err);
      alert("Verification failed.");
    }
  };

  const handleDownload = async (evidenceId) => {
    try {
      const res = await axios.get(`http://localhost:3000/report/${evidenceId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `report_${evidenceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.log(err);
      alert("Failed to download report");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <div style={{ padding: "30px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ color: "#2c3e50" }}>ForensiVault Dashboard</h1>
      <button
        onClick={handleLogout}
        style={{
          backgroundColor: "#e74c3c",
          color: "white",
          border: "none",
          padding: "8px 16px",
          cursor: "pointer",
          float: "right",
          borderRadius: "5px",
        }}
      >
        Logout
      </button>

      <h2 style={{ marginTop: "80px", color: "#34495e" }}>Upload Evidence</h2>
      <form onSubmit={handleUpload} style={{ marginBottom: "30px" }}>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ marginRight: "10px" }}
        />
        <button
          type="submit"
          style={{
            backgroundColor: "#3498db",
            color: "white",
            border: "none",
            padding: "6px 12px",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Upload
        </button>
      </form>

      <h2 style={{ color: "#34495e" }}>Uploaded Evidence / Logs</h2>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: "10px",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#2980b9", color: "white" }}>
            <th style={{ padding: "10px" }}>Index</th>
            <th>Action</th>
            <th>Evidence ID</th>
            <th>Timestamp</th>
            <th>Verify</th>
            <th>Report</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => (
            <tr key={index} style={{ textAlign: "center", borderBottom: "1px solid #ccc" }}>
              <td>{index}</td>
              <td>{log.action}</td>
              <td>{log.evidenceId || "-"}</td>
              <td>{new Date(log.timestamp).toLocaleString()}</td>
              <td>
                {log.evidenceId && (
                  <button
                    onClick={() => handleVerify(log.evidenceId)}
                    style={{
                      backgroundColor: "#27ae60",
                      color: "white",
                      border: "none",
                      padding: "5px 10px",
                      borderRadius: "5px",
                      cursor: "pointer",
                    }}
                  >
                    Verify
                  </button>
                )}
              </td>
              <td>
                {log.evidenceId && (
                  <button
                    onClick={() => handleDownload(log.evidenceId)}
                    style={{
                      backgroundColor: "#8e44ad",
                      color: "white",
                      border: "none",
                      padding: "5px 10px",
                      borderRadius: "5px",
                      cursor: "pointer",
                    }}
                  >
                    Download PDF
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
