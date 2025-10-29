import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import AuthGuard from "./components/AuthGuard";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import Dashboard from "./pages/Dashboard";
import UploadContacts from "./pages/UploadContacts";
import CallLogs from "./pages/CallLogs";
import CallTablePage from "./pages/CallTablePage";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import UserManagement from "./pages/UserManagement";

function App() {
  return (
    <AuthProvider>
      <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb" }}>
        <Router>
          <AuthGuard>
            <div style={{ display: "flex", height: "100vh" }}>
              <Sidebar />
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <TopBar />
                <main
                  style={{
                    flex: 1,
                    overflowX: "hidden",
                    overflowY: "auto",
                    backgroundColor: "#f9fafb",
                  }}
                >
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/login" element={<Dashboard />} />
                    <Route
                      path="/upload"
                      element={
                        <AuthGuard requiredRole="admin">
                          <UploadContacts />
                        </AuthGuard>
                      }
                    />
                    <Route path="/calls" element={<CallLogs />} />
                    <Route path="/call-table" element={<CallTablePage />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route
                      path="/reports"
                      element={
                        <AuthGuard requiredRole="admin">
                          <Reports />
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/users"
                      element={
                        <AuthGuard requiredRole="admin">
                          <UserManagement />
                        </AuthGuard>
                      }
                    />
                  </Routes>
                </main>
              </div>
            </div>
          </AuthGuard>
        </Router>
      </div>
    </AuthProvider>
  );
}

export default App;
