import { useEffect } from "react";

function App() {
  useEffect(() => {
    // Redirect to the standalone admin dashboard
    window.location.href = "/admin-dashboard.html";
  }, []);

  return null;
}

export default App;
