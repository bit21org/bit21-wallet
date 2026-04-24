import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return React.createElement("div", {
        style: { color: "#EF4444", background: "#0D0D0D", padding: 40, minHeight: "100vh", fontFamily: "monospace" }
      },
        React.createElement("h2", null, "App Error"),
        React.createElement("pre", { style: { whiteSpace: "pre-wrap" } }, this.state.error.toString()),
        React.createElement("pre", { style: { whiteSpace: "pre-wrap", color: "#737373", marginTop: 16 } }, this.state.error.stack)
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// ── Register Service Worker for PWA ──
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
