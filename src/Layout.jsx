export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <style>{`
        * { box-sizing: border-box; }
        :root {
          --background: #0a0e1a;
          --foreground: #ffffff;
        }
        body { background: #0a0e1a; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
      `}</style>
      {children}
    </div>
  );
}