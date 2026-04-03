import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Shield, 
  Trash2, 
  Mail, 
  Lock,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Smartphone,
  QrCode,
  Key
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  setDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as authSignOut } from 'firebase/auth';
import { auth, db, firebaseConfig } from '@/src/firebase';
import { Role, User } from '@/src/types';
import { handleFirestoreError, OperationType } from '@/src/lib/utils';
import { authenticator } from '@otplib/preset-browser';
import QRCode from 'qrcode';

const Settings: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 2FA State
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [tempSecret, setTempSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [showDisable2FAConfirm, setShowDisable2FAConfirm] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'staff' as Role,
    name: ''
  });

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; userId: string; userName: string }>({ 
    isOpen: false, 
    userId: '', 
    userName: '' 
  });

  useEffect(() => {
    // Fetch all users for management (Super Admin only view usually)
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as any[];
      setUsers(usersList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    // Fetch current user data for security settings
    if (auth.currentUser) {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const unsubscribeUser = onSnapshot(userDocRef, (snapshot) => {
        if (snapshot.exists()) {
          setCurrentUserData({ id: snapshot.id, ...snapshot.data() } as any);
        }
      });
      return () => {
        unsubscribe();
        unsubscribeUser();
      };
    }

    return unsubscribe;
  }, [auth.currentUser]);

  const handleSetup2FA = async () => {
    if (!currentUserData) return;
    
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(
      currentUserData.email,
      'House of Sambhav',
      secret
    );
    
    try {
      const url = await QRCode.toDataURL(otpauth);
      setTempSecret(secret);
      setQrCodeUrl(url);
      setIs2FAModalOpen(true);
      setVerificationCode('');
      setTwoFactorError('');
    } catch (err) {
      console.error('QR Code generation error:', err);
    }
  };

  const verifyAndEnable2FA = async () => {
    if (!auth.currentUser || !tempSecret) return;
    
    const isValid = authenticator.check(verificationCode, tempSecret);
    
    if (isValid) {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          twoFactorEnabled: true,
          twoFactorSecret: tempSecret,
          updatedAt: serverTimestamp()
        });
        setIs2FAModalOpen(false);
        setTempSecret('');
        setQrCodeUrl('');
        setVerificationCode('');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      }
    } else {
      setTwoFactorError('Invalid verification code. Please try again.');
    }
  };

  const disable2FA = async () => {
    if (!auth.currentUser) return;
    
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        twoFactorEnabled: false,
        twoFactorSecret: '',
        updatedAt: serverTimestamp()
      });
      setShowDisable2FAConfirm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // 1. Create Auth User using a secondary Firebase instance
      // This allows creating a user without signing out the current admin
      let secondaryApp;
      const secondaryAppName = 'SecondaryAuthApp';
      
      if (getApps().some(app => app.name === secondaryAppName)) {
        secondaryApp = getApp(secondaryAppName);
      } else {
        secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      }
      
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        formData.email.toLowerCase(), 
        formData.password
      );
      
      const newUid = userCredential.user.uid;
      
      // Sign out the secondary instance immediately
      await authSignOut(secondaryAuth);

      // 2. Create Firestore Document with the new UID
      try {
        await setDoc(doc(db, 'users', newUid), {
          uid: newUid,
          email: formData.email.toLowerCase(),
          role: formData.role,
          name: formData.name || formData.email.split('@')[0],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (firestoreErr) {
        handleFirestoreError(firestoreErr, OperationType.WRITE, `users/${newUid}`);
      }

      setIsModalOpen(false);
      setFormData({ email: '', password: '', role: 'staff', name: '' });
      setFeedbackMessage({ type: 'success', text: 'User account created successfully.' });
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (error: any) {
      console.error("Error creating user:", error);
      setFeedbackMessage({ type: 'error', text: error.message || "Failed to create user account." });
      setTimeout(() => setFeedbackMessage(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (docId: string, newRole: Role) => {
    // Prevent changing role of hardcoded admins
    const user = users.find(u => u.id === docId);
    if (user && (user.email === 'kushwahaniit@gmail.com' || user.email === 'learnnovative@gmail.com')) {
      setFeedbackMessage({ type: 'error', text: "Cannot change role of protected Super Admin account." });
      setTimeout(() => setFeedbackMessage(null), 3000);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', docId), { 
        role: newRole,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${docId}`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal.userId) return;
    
    try {
      await deleteDoc(doc(db, 'users', deleteModal.userId));
      setDeleteModal({ isOpen: false, userId: '', userName: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${deleteModal.userId}`);
    }
  };

  const handleDeleteClick = (user: any) => {
    // Prevent deleting self
    if (user.uid === auth.currentUser?.uid) {
      setFeedbackMessage({ type: 'error', text: "You cannot delete your own account." });
      setTimeout(() => setFeedbackMessage(null), 3000);
      return;
    }

    // Prevent deleting hardcoded admins
    if (user.email === 'kushwahaniit@gmail.com' || user.email === 'learnnovative@gmail.com') {
      setFeedbackMessage({ type: 'error', text: "Protected Super Admin accounts cannot be deleted." });
      setTimeout(() => setFeedbackMessage(null), 3000);
      return;
    }

    setDeleteModal({
      isOpen: true,
      userId: user.id,
      userName: user.name || user.email
    });
  };

  return (
    <div className="space-y-6">
      {/* Feedback Message */}
      {feedbackMessage && (
        <div className={`fixed top-4 right-4 z-[100] p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-5 ${
          feedbackMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {feedbackMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <p className="font-bold">{feedbackMessage.text}</p>
        </div>
      )}

      {/* Security Settings Section */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm p-4 transition-colors duration-300">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-500 rounded-xl flex items-center justify-center shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="font-bold text-stone-900 dark:text-stone-50 text-sm sm:text-base">Security Settings</h2>
              <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                Two-Factor Authentication is {currentUserData?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
          
          {currentUserData?.twoFactorEnabled ? (
            <div className="relative">
              <button 
                onClick={() => setShowDisable2FAConfirm(true)}
                className="px-4 py-2 bg-white dark:bg-stone-800 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0"
              >
                Disable 2FA
              </button>

              {showDisable2FAConfirm && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-stone-900 rounded-xl shadow-xl border border-stone-200 dark:border-stone-800 p-4 z-50 animate-in fade-in slide-in-from-top-2">
                  <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">Are you sure you want to disable Two-Factor Authentication? This will make your account less secure.</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={disable2FA}
                      className="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-red-700"
                    >
                      Yes, Disable
                    </button>
                    <button 
                      onClick={() => setShowDisable2FAConfirm(false)}
                      className="flex-1 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 py-2 rounded-lg text-xs font-bold hover:bg-stone-200 dark:hover:bg-stone-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={handleSetup2FA}
              className="px-4 py-2 bg-amber-700 text-white rounded-lg text-xs font-bold hover:bg-amber-800 transition-all shadow-md shadow-amber-700/10 shrink-0"
            >
              Enable 2FA
            </button>
          )}
        </div>
      </div>

      {/* 2FA Setup Modal */}
      {is2FAModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl p-8 my-auto transition-colors duration-300">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <QrCode size={32} />
              </div>
              <h3 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-50">Setup 2FA</h3>
              <p className="text-stone-500 dark:text-stone-400">Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
            </div>

            <div className="bg-stone-50 dark:bg-stone-800/50 p-6 rounded-2xl border border-stone-200 dark:border-stone-700 flex flex-col items-center mb-6">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48 mb-4 border-4 border-white dark:border-stone-800 rounded-lg shadow-sm" />
              ) : (
                <div className="w-48 h-48 bg-stone-200 dark:bg-stone-700 animate-pulse rounded-lg mb-4"></div>
              )}
              <div className="text-center">
                <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">Manual Entry Key</p>
                <code className="bg-white dark:bg-stone-800 px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-700 text-amber-700 dark:text-amber-500 font-mono font-bold select-all">
                  {tempSecret}
                </code>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Verify Code</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="text" 
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-10 pr-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all text-center text-2xl tracking-[0.5em] font-bold dark:text-stone-100"
                    placeholder="000000"
                  />
                </div>
                {twoFactorError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {twoFactorError}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIs2FAModalOpen(false)}
                  className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-xl font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={verifyAndEnable2FA}
                  disabled={verificationCode.length !== 6}
                  className="flex-1 py-3 bg-amber-700 text-white rounded-xl font-bold hover:bg-amber-800 transition-all shadow-lg shadow-amber-700/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Verify & Enable
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-50">Account Management</h2>
          <p className="text-stone-500 dark:text-stone-400">Manage staff roles and access permissions.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-amber-700 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-amber-800 transition-all shadow-lg shadow-amber-700/20 text-sm"
        >
          <UserPlus size={18} />
          <span>Add New User</span>
        </button>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden transition-colors duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800">
                <th className="px-6 py-4 text-sm font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-sm font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-sm font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-sm font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {users.map((user: any) => (
                <tr key={user.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-xl flex items-center justify-center text-stone-500 dark:text-stone-400">
                        <UserIcon size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-stone-900 dark:text-stone-50">{user.name || 'User'}</p>
                        <p className="text-sm text-stone-500 dark:text-stone-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={user.role}
                      onChange={(e) => handleUpdateRole(user.id, e.target.value as Role)}
                      className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none dark:text-stone-100"
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="store_manager">Store Manager</option>
                      <option value="staff">Staff</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    {user.uid ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full text-xs font-bold w-fit">
                        <CheckCircle2 size={14} />
                        Active
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full text-xs font-bold w-fit">
                        <AlertCircle size={14} />
                        Pending
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDeleteClick(user)}
                      className="p-2 text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center my-auto transition-colors duration-300">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-50 mb-2">Delete Account?</h3>
            <p className="text-stone-500 dark:text-stone-400 mb-8">
              Are you sure you want to remove <span className="font-bold text-stone-900 dark:text-stone-50">{deleteModal.userName}</span>? 
              This action will revoke their access to the system immediately.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteModal({ isOpen: false, userId: '', userName: '' })}
                className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-xl font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-8 my-auto transition-colors duration-300">
            <h3 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-50 mb-6">Add New User</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all dark:text-stone-100"
                    placeholder="John Doe"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="email" 
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all dark:text-stone-100"
                    placeholder="staff@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-10 pr-12 py-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all dark:text-stone-100"
                    placeholder="••••••••"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="mt-2 text-xs text-stone-400 dark:text-stone-500">Minimum 6 characters. User can log in immediately with this password.</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">Assign Role</label>
                <div className="grid grid-cols-1 gap-2">
                  {(['staff', 'store_manager', 'super_admin'] as Role[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setFormData({ ...formData, role })}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        formData.role === role 
                          ? 'border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-500' 
                          : 'border-stone-100 dark:border-stone-800 hover:border-stone-200 dark:hover:border-stone-700 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <Shield size={18} className={formData.role === role ? 'text-amber-600' : 'text-stone-400'} />
                      <div>
                        <p className="font-bold capitalize text-sm">{role.replace('_', ' ')}</p>
                        <p className="text-[10px] opacity-70 leading-tight">
                          {role === 'super_admin' && 'Full access to all settings and users.'}
                          {role === 'store_manager' && 'Manage inventory, orders, and billing.'}
                          {role === 'staff' && 'Process orders and view inventory.'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-xl font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-amber-700 text-white rounded-xl font-bold hover:bg-amber-800 transition-all shadow-lg shadow-amber-700/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
