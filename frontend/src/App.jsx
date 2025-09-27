import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { Toaster } from 'react-hot-toast';

// Import Page Components
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PublicPortfolio from './pages/PublicPortfolio';
import Spinner from './components/Spinner';

// Import the student layout and its pages
import StudentLayout from './pages/Student/StudentLayout';
import StudentProfile from './pages/Student/StudentProfile';
import StudentAchievements from './pages/Student/StudentAchievements';
import StudentRecommendations from './pages/Student/StudentRecommendations';
import StudentPathway from './pages/Student/StudentPathway';
import FindTeammates from './pages/Student/FindTeammates';

// Import the Faculty Layout and its pages
import FacultyLayout from './pages/Faculty/FacultyLayout';
import FacultyProfile from './pages/Faculty/FacultyProfile';
import FacultyApproval from './pages/Faculty/FacultyApproval';
import FacultyClassView from './pages/Faculty/FacultyClassView';
import FacultyReports from './pages/Faculty/FacultyReports';
import FacultyAnalytics from './pages/Faculty/FacultyAnalytics';


// --- Protected Route Component ---
const ProtectedRoute = ({ user, userRole, requiredRole, isLoading, component: Component }) => {
    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-gray-900"><Spinner /></div>;
    }
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    if (userRole !== requiredRole) {
        // If the role doesn't match, redirect to login to prevent access.
        // In a more complex app, this could go to an "Unauthorized" page.
        return <Navigate to="/login" replace />;
    }
    return <Component user={user} />;
};


// --- Main App Component ---
const App = () => {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const auth = getAuth();
    const db = getFirestore();

    useEffect(() => {
        // This onAuthStateChanged listener is the core of Firebase session management.
        // It runs once on initial load and again whenever the user's auth state changes.
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // If a user is found, fetch their role from Firestore
                const docRef = doc(db, "users", currentUser.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setUserRole(docSnap.data().role);
                }
                setUser(currentUser);
            } else {
                // If no user, clear the state
                setUser(null);
                setUserRole(null);
            }
            // Finished checking, no longer loading
            setIsLoading(false);
        });

        // Cleanup the listener when the component unmounts
        return () => unsubscribe();
    }, [auth, db]);

    return (
        <>
            <Toaster
                position="top-center"
                reverseOrder={false}
                toastOptions={{ style: { background: '#333', color: '#fff' } }}
            />
           
                <Routes>
                    {/* Public routes that are always accessible */}
                    <Route path="/portfolio/:studentId" element={<PublicPortfolio />} />

                    {/* Routes for logged-out users. If a user is logged in, they are redirected. */}
                    <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
                    <Route path="/register" element={user ? <Navigate to="/" /> : <RegisterPage />} />

                    {/* Protected Student Routes with Nested Layout */}
                    <Route
                        path="/student-dashboard"
                        element={
                            <ProtectedRoute
                                user={user}
                                userRole={userRole}
                                requiredRole="student"
                                isLoading={isLoading}
                                component={StudentLayout}
                            />
                        }
                    >
                        <Route index element={<Navigate to="profile" replace />} />
                        <Route path="profile" element={<StudentProfile />} />
                        <Route path="achievements" element={<StudentAchievements />} />
                        <Route path="recommendations" element={<StudentRecommendations />} />
                        <Route path="pathway" element={<StudentPathway />} />
                        <Route path="find-teammates" element={<FindTeammates />} />
                    </Route>

                    {/* Protected Faculty Routes with Nested Layout */}
                    <Route
                        path="/faculty-dashboard"
                        element={
                            <ProtectedRoute
                                user={user}
                                userRole={userRole}
                                requiredRole="faculty"
                                isLoading={isLoading}
                                component={FacultyLayout}
                            />
                        }
                    >
                        <Route index element={<Navigate to="profile" replace />} />
                        <Route path="profile" element={<FacultyProfile />} />
                        <Route path="approval" element={<FacultyApproval />} />
                        <Route path="class-view" element={<FacultyClassView />} />
                        <Route path="reports" element={<FacultyReports />} />
                        <Route path="analytics" element={<FacultyAnalytics />} />
                    </Route>

                    {/* --- Core Root Path Redirect Logic --- */}
                    <Route
                        path="/"
                        element={
                            isLoading ? (
                                <div className="flex items-center justify-center h-screen bg-gray-900"><Spinner /></div>
                            ) : !user ? (
                                <Navigate to="/login" /> // If no user, go to login
                            ) : userRole === 'student' ? (
                                <Navigate to="/student-dashboard" /> // If student, go to their dashboard
                            ) : userRole === 'faculty' ? (
                                <Navigate to="/faculty-dashboard" /> // If faculty, go to their dashboard
                            ) : (
                                <Navigate to="/login" /> // A fallback for any edge cases
                            )
                        }
                    />
                </Routes>
           
        </>
    );
};

export default App;

