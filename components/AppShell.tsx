import Sidebar from "./Sidebar";
import Footer from "./Footer";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="app-shell"><Sidebar /><div className="main-area">{children}<Footer /></div></div>;
}
