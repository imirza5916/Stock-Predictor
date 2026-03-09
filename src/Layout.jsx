export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { background: #f1f5f9; font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 3px; }

        /* Focus rings for accessibility */
        :focus-visible {
          outline: 2px solid #6366f1;
          outline-offset: 2px;
          border-radius: 6px;
        }

        /* Smooth transitions */
        button, a, input { transition: all 0.15s ease; }

        /* Better text rendering */
        body { -webkit-font-smoothing: antialiased; }
      `}</style>
      {children}
    </div>
  );
}