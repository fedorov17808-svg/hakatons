"use client";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0a0a12 0%, #1a1a2e 100%)",
        color: "#e0e0e0",
        fontFamily: "'Inter', system-ui, sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1
        style={{
          fontSize: "6rem",
          fontWeight: 800,
          background: "linear-gradient(135deg, #00d4ff, #7b61ff)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          margin: 0,
        }}
      >
        404
      </h1>
      <p style={{ fontSize: "1.5rem", margin: "1rem 0", opacity: 0.8 }}>
        Page not found
      </p>
      <p style={{ fontSize: "1rem", opacity: 0.5, maxWidth: 400 }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <a
        href="/"
        style={{
          marginTop: "2rem",
          padding: "0.75rem 2rem",
          background: "linear-gradient(135deg, #00d4ff, #7b61ff)",
          color: "#fff",
          borderRadius: "8px",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: "1rem",
          transition: "opacity 0.2s",
        }}
      >
        ← Back to Dashboard
      </a>
    </div>
  );
}
