import React, { useState, useEffect } from 'react';
import { Menu, Bell, Search, User, LogIn, ShieldCheck, Mail, Lock, AlertCircle, Key, Smartphone, Sun, Moon } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import Sidebar from './components/Sidebar';
import logo from './assets/logo.png';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
import Help from './pages/Help';
import Settings from './pages/Settings';
import ErrorBoundary from './components/ErrorBoundary';
import { handleFirestoreError, OperationType } from './lib/utils';
import { authenticator } from '@otplib/preset-browser';

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  console.log('AppContent initializing...');
  const [activeTab, setActiveTab] = useState('inventory');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('staff');
  const [loading, setLoading] = useState(true);
  const [loginMethod, setLoginMethod] = useState<'google' | 'email'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' || 
             (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  
  // 2FA State
  const [needs2FA, setNeeds2FA] = useState(false);
  const [is2FAVerified, setIs2FAVerified] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [userSecret, setUserSecret] = useState('');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  useEffect(() => {
    // Force session persistence so users aren't automatically logged in on launch
    setPersistence(auth, browserSessionPersistence).catch(err => {
      console.error('Error setting persistence:', err);
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setNeeds2FA(false);
      setIs2FAVerified(false);
      setTwoFactorCode('');
      setTwoFactorError('');

      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            console.log('User document found:', userDoc.data());
            const userData = userDoc.data();
            
            // Ensure hardcoded admins always have super_admin role
            const isHardcodedAdmin = (firebaseUser.email === 'kushwahaniit@gmail.com' || firebaseUser.email === 'learnnovative@gmail.com');
            const role = isHardcodedAdmin ? 'super_admin' : userData.role;
            setUserRole(role);
            
            if (userData.twoFactorEnabled) {
              setNeeds2FA(true);
              setUserSecret(userData.twoFactorSecret);
            }
          } else {
            console.log('User document not found. Checking for pre-assigned role...');
            // 2. Check if an admin pre-assigned a role by email
            const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
            try {
              const querySnapshot = await getDocs(q);
              
              if (!querySnapshot.empty) {
                const existingDoc = querySnapshot.docs[0];
                console.log('Pre-assigned role found:', existingDoc.data());
                const role = existingDoc.data().role;
                
                // Update existing doc with UID and info
                try {
                  await updateDoc(doc(db, 'users', existingDoc.id), {
                    uid: firebaseUser.uid,
                    name: firebaseUser.displayName || existingDoc.data().name || 'User',
                    updatedAt: serverTimestamp()
                  });
                  setUserRole(role);
                } catch (err) {
                  console.error('Error updating pre-assigned user:', err);
                  handleFirestoreError(err, OperationType.UPDATE, `users/${existingDoc.id}`);
                }
              } else {
                console.log('No pre-assigned role. Access denied.');
                // 3. Check if it's a hardcoded admin who hasn't been created yet
                const isHardcodedAdmin = (firebaseUser.email === 'kushwahaniit@gmail.com' || firebaseUser.email === 'learnnovative@gmail.com');
                
                if (isHardcodedAdmin) {
                  console.log('Hardcoded admin detected. Auto-creating account...');
                  try {
                    await setDoc(doc(db, 'users', firebaseUser.uid), {
                      uid: firebaseUser.uid,
                      email: firebaseUser.email,
                      name: firebaseUser.displayName || 'Super Admin',
                      role: 'super_admin',
                      createdAt: serverTimestamp()
                    });
                    setUserRole('super_admin');
                    setUser(firebaseUser);
                  } catch (err) {
                    console.error("Error creating super admin document:", err);
                    handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
                  }
                } else {
                  // Not an admin and no pre-assigned role
                  setError('Access denied. Your account has not been authorized by an administrator.');
                  await signOut(auth);
                  setUser(null);
                }
              }
            } catch (err) {
              console.error('Error querying users by email:', err);
              handleFirestoreError(err, OperationType.LIST, 'users');
            }
          }
          setUser(firebaseUser);
        } catch (error: any) {
          console.error("Auth initialization error:", error);
          setError(error.message || "Failed to initialize user session.");
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setUserRole('staff');
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    // Force account selection every time
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Email login error:", err);
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleVerify2FA = (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError('');
    
    if (!userSecret) {
      setTwoFactorError('Security error: 2FA secret not found.');
      return;
    }

    const isValid = authenticator.check(twoFactorCode, userSecret);
    
    if (isValid) {
      setIs2FAVerified(true);
    } else {
      setTwoFactorError('Invalid verification code. Please try again.');
    }
  };

  const renderContent = () => {
    const isSuperAdmin = userRole === 'super_admin';
    
    switch (activeTab) {
      case 'dashboard': 
        return isSuperAdmin ? <Dashboard userRole={userRole} /> : <Inventory userRole={userRole} />;
      case 'inventory': 
        return <Inventory userRole={userRole} />;
      case 'orders': 
        return <Orders userRole={userRole} />;
      case 'customers': 
        return isSuperAdmin ? <Customers userRole={userRole} /> : <Orders userRole={userRole} />;
      case 'help': 
        return <Help />;
      case 'settings': 
        return isSuperAdmin ? <Settings /> : <Help />;
      default: 
        return isSuperAdmin ? <Dashboard userRole={userRole} /> : <Inventory userRole={userRole} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 transition-colors duration-300">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-700"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 p-4 transition-colors duration-300 relative">
        <div className="absolute top-6 right-6">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-3 bg-white dark:bg-stone-800 text-stone-50 dark:text-stone-400 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 transition-all"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xl max-w-md w-full text-center">
          <div className="w-24 h-24 bg-white dark:bg-stone-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-stone-100 dark:border-stone-700 overflow-hidden">
            <img 
              src={logo} 
              alt="House of Sambhav Logo" 
              className="w-full h-full object-contain p-2"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://ui-avatars.com/api/?name=House+of+Sambhav&background=78350f&color=fff&bold=true&size=256";
              }}
            />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-900 dark:text-stone-50 mb-2">House of Sambhav</h1>
          <p className="text-stone-500 dark:text-stone-400 mb-8">Please sign in to access the omnichannel management system.</p>
          
          {loginMethod === 'google' ? (
            <div className="space-y-4">
              <button 
                onClick={handleGoogleLogin}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-3 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 py-4 rounded-2xl font-bold hover:bg-stone-800 dark:hover:bg-white transition-all disabled:opacity-50"
              >
                {authLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                ) : (
                  <>
                    <LogIn size={20} />
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => setLoginMethod('email')}
                  className="text-amber-700 font-bold hover:underline"
                >
                  Sign in with Email & Password
                </button>
              </div>
            </div>
          ) : loginMethod === 'email' ? (
            <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/30 mb-4 flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all dark:text-stone-100"
                    placeholder="name@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all dark:text-stone-100"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <button 
                type="submit"
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-3 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 py-4 rounded-2xl font-bold hover:bg-stone-800 dark:hover:bg-white transition-all disabled:opacity-50"
              >
                {authLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                ) : (
                  <>
                    <LogIn size={20} />
                    <span>Sign in with Email</span>
                  </>
                )}
              </button>
              <div className="flex flex-col items-center gap-2">
                <button 
                  type="button"
                  onClick={() => setLoginMethod('google')}
                  className="text-stone-500 font-bold hover:text-stone-700 text-sm"
                >
                  Back to Google Login
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-8">
              <p className="text-stone-500 dark:text-stone-400 mb-4">New account creation is restricted to administrators.</p>
              <button 
                type="button"
                onClick={() => setLoginMethod('google')}
                className="text-amber-700 font-bold hover:underline text-sm"
              >
                Back to Login
              </button>
            </div>
          )}

          <p className="mt-6 text-xs text-stone-400">
            Access is restricted to authorized personnel only.
          </p>
        </div>
      </div>
    );
  }

  if (needs2FA && !is2FAVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 p-4 transition-colors duration-300 relative">
        <div className="absolute top-6 right-6">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-3 bg-white dark:bg-stone-800 text-stone-50 dark:text-stone-400 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 transition-all"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-xl max-w-md w-full text-center">
          <div className="w-24 h-24 bg-white dark:bg-stone-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-stone-100 dark:border-stone-700 overflow-hidden">
            <img 
              src={logo} 
              alt="House of Sambhav Logo" 
              className="w-full h-full object-contain p-2"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://picsum.photos/seed/houseofsambhav/200/200";
              }}
            />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-900 dark:text-stone-50 mb-2">Two-Factor Auth</h1>
          <p className="text-stone-500 dark:text-stone-400 mb-8">Please enter the 6-digit verification code from your authenticator app.</p>
          
          <form onSubmit={handleVerify2FA} className="space-y-6">
            <div>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <input 
                  type="text" 
                  required
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-12 pr-4 py-4 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all text-center text-3xl tracking-[0.5em] font-bold dark:text-stone-100"
                  placeholder="000000"
                  autoFocus
                />
              </div>
              {twoFactorError && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/30 flex items-center gap-2 justify-center">
                  <AlertCircle size={16} />
                  {twoFactorError}
                </div>
              )}
            </div>

            <button 
              type="submit"
              disabled={twoFactorCode.length !== 6}
              className="w-full flex items-center justify-center gap-3 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 py-4 rounded-2xl font-bold hover:bg-stone-800 dark:hover:bg-white transition-all disabled:opacity-50"
            >
              <ShieldCheck size={20} />
              <span>Verify & Continue</span>
            </button>

            <button 
              type="button"
              onClick={handleLogout}
              className="w-full text-center text-stone-500 font-bold hover:text-stone-700"
            >
              Cancel and Sign Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans selection:bg-amber-100 selection:text-amber-900 transition-colors duration-300">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
        userRole={userRole}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 lg:h-20 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-3 lg:hidden">
              <img 
                src={logo} 
                alt="Logo" 
                className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl object-contain p-1 shadow-sm border border-stone-100 dark:border-stone-700"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://ui-avatars.com/api/?name=House+of+Sambhav&background=78350f&color=fff&bold=true&size=256";
                }}
              />
            </div>
            <div className="hidden md:flex items-center gap-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-2 w-64 lg:w-80">
              <Search size={18} className="text-stone-400" />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="bg-transparent border-none outline-none text-sm w-full dark:text-stone-100"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 rounded-full text-xs font-bold uppercase tracking-wider">
              <ShieldCheck size={14} />
              {userRole.replace('_', ' ')}
            </div>
            <button className="p-2 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors relative">
              <Bell size={22} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-amber-600 rounded-full border-2 border-white dark:border-stone-900"></span>
            </button>
            <div className="h-8 w-px bg-stone-200 dark:bg-stone-800 mx-2 hidden sm:block"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-stone-900 dark:text-stone-50">{user.displayName || user.email.split('@')[0]}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">{user.email}</p>
              </div>
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName} 
                  className="w-10 h-10 rounded-xl object-cover border border-stone-200 dark:border-stone-700"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold border border-amber-200 dark:border-amber-800">
                  {user.email.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
