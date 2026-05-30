import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [influencers, setInfluencers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    axios
      .get("http://127.0.0.1:5000/api/influencers")
      .then((response) => {
        setInfluencers(response.data);
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  const filteredInfluencers = influencers.filter((inf) =>
    inf.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "20px" }}>
      <h1>AI Influencer Dashboard</h1>

      <div>
        <h3>Total Influencers: {filteredInfluencers.length}</h3>
      </div>

      <input
        type="text"
        placeholder="Search influencer..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: "8px",
          marginBottom: "15px",
          width: "300px",
        }}
      />

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Name</th>
            <th>Followers</th>
            <th>Engagement</th>
          </tr>
        </thead>

        <tbody>
          {filteredInfluencers.map((inf, index) => (
            <tr key={index}>
              <td>{inf.name}</td>
              <td>{inf.followers.toLocaleString()}</td>
              <td>{inf.engagement}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;