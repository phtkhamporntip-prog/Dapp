
import { doc, updateDoc, runTransaction, setDoc, serverTimestamp, collection, getDocs, query, where, limit, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase.js';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { formatApiError } from '../lib/errorHandling';
import { isFirebaseReady } from '../utils/firebaseHelpers';

/**
 * Updates the KYC status for a given user.
 * @param {string} userId - The ID of the user to update.
 * @param {string} kycStatus - The new KYC status ('verified', 'rejected').
 */
export const updateUserKYC = async (userId, kycStatus) => {
    if (!isFirebaseReady()) {
        // Fallback for localStorage
        try {
            const users = JSON.parse(localStorage.getItem('users') || '{}');
            if (users[userId]) {
                users[userId].kycStatus = kycStatus;
                localStorage.setItem('users', JSON.stringify(users));
            }
        } catch (error) {
            console.error("Error updating KYC in localStorage:", error);
        }
        return;
    }
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { kycStatus });
    } catch (error) {
        console.error(`Error updating KYC for user ${userId}:`, error);
        throw new Error(formatApiError(error));
    }
};

/**
 * Processes a deposit by approving or rejecting it.
 * @param {string} depositId - The ID of the deposit.
 * @param {string} userId - The ID of the user who made the deposit.
 * @param {'approved' | 'rejected'} newStatus - The new status of the deposit.
 * @param {number} [amount=0] - The amount of the deposit (only required for approval).
 */
export const processDeposit = async (depositId, userId, newStatus, amount = 0) => {
    if (!isFirebaseReady()) {
        // Fallback for localStorage
        try {
            const deposits = JSON.parse(localStorage.getItem('deposits') || '[]');
            const depositIndex = deposits.findIndex(d => d.id === depositId);
            if (depositIndex > -1) {
                deposits[depositIndex].status = newStatus;
                localStorage.setItem('deposits', JSON.stringify(deposits));

                const userDepositsKey = `userDeposits_${userId}`;
                const userDeposits = JSON.parse(localStorage.getItem(userDepositsKey) || '[]');
                const userDepositIndex = userDeposits.findIndex(d => d.id === depositId);
                if (userDepositIndex > -1) {
                    userDeposits[userDepositIndex].status = newStatus;
                    localStorage.setItem(userDepositsKey, JSON.stringify(userDeposits));
                }

                if (newStatus === 'approved') {
                    const users = JSON.parse(localStorage.getItem('users') || '{}');
                    if (users[userId]) {
                        users[userId].balance = (users[userId].balance || 0) + parseFloat(amount);
                        localStorage.setItem('users', JSON.stringify(users));
                    }
                }
            }
        } catch (error) {
            console.error("Error processing deposit in localStorage:", error);
        }
        return;
    }

    try {
        const depositRef = doc(db, 'deposits', depositId);
        const userRef = doc(db, 'users', userId);

        if (newStatus === 'approved') {
            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) {
                    throw new Error("User document not found!");
                }
                const currentBalance = userDoc.data().balance || 0;
                const newBalance = currentBalance + parseFloat(amount);

                transaction.update(userRef, { balance: newBalance });
                transaction.update(depositRef, { status: newStatus });
            });
        } else { // For 'rejected' status
            await updateDoc(depositRef, { status: newStatus });
        }
    } catch (error) {
        console.error(`Error processing deposit ${depositId}:`, error);
        throw new Error(formatApiError(error));
    }
};

/**
 * Processes a withdrawal by approving or rejecting it.
 * Rejected withdrawals restore the amount because the balance is reserved at request time.
 * @param {string} withdrawalId - The ID of the withdrawal.
 * @param {string} userId - The ID of the user who made the withdrawal.
 * @param {'approved' | 'rejected'} newStatus - The new status of the withdrawal.
 * @param {number} [amount=0] - The amount of the withdrawal.
 */
export const processWithdrawal = async (withdrawalId, userId, newStatus, amount = 0) => {
    if (!isFirebaseReady()) {
        try {
            const withdrawals = JSON.parse(localStorage.getItem('withdrawals') || '[]');
            const withdrawalIndex = withdrawals.findIndex(w => w.id === withdrawalId);
            if (withdrawalIndex > -1) {
                withdrawals[withdrawalIndex].status = newStatus;
                localStorage.setItem('withdrawals', JSON.stringify(withdrawals));
            }

            const userWithdrawalsKey = `userWithdrawals_${userId}`;
            const userWithdrawals = JSON.parse(localStorage.getItem(userWithdrawalsKey) || '[]');
            const userWithdrawalIndex = userWithdrawals.findIndex(w => w.id === withdrawalId);
            if (userWithdrawalIndex > -1) {
                userWithdrawals[userWithdrawalIndex].status = newStatus;
                localStorage.setItem(userWithdrawalsKey, JSON.stringify(userWithdrawals));
            }

            if (newStatus === 'rejected') {
                const users = JSON.parse(localStorage.getItem('users') || '{}');
                if (users[userId]) {
                    users[userId].balance = (users[userId].balance || 0) + parseFloat(amount);
                    localStorage.setItem('users', JSON.stringify(users));
                }
            }
            return;
        } catch (error) {
            console.error('Error processing withdrawal in localStorage:', error);
        }
        return;
    }

    try {
        const withdrawalRef = doc(db, 'withdrawals', withdrawalId);
        const userRef = doc(db, 'users', userId);

        if (newStatus === 'rejected') {
            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) {
                    throw new Error('User document not found!');
                }

                const currentBalance = userDoc.data().balance || 0;
                const refundedBalance = currentBalance + parseFloat(amount);

                transaction.update(userRef, { balance: refundedBalance });
                transaction.update(withdrawalRef, { status: newStatus, updatedAt: serverTimestamp() });
            });
        } else {
            await updateDoc(withdrawalRef, { status: newStatus, updatedAt: serverTimestamp() });
        }
    } catch (error) {
        console.error(`Error processing withdrawal ${withdrawalId}:`, error);
        throw new Error(formatApiError(error));
    }
};

export const getAdminByEmail = async (email) => {
    if (!isFirebaseReady()) {
        try {
            const admins = JSON.parse(localStorage.getItem('admins') || '{}');
            return Object.values(admins).find(admin => admin.email === email);
        } catch (error) {
            console.error("Error getting admin by email from localStorage:", error);
            return null;
        }
    }

    try {
        // Query the admins collection by email field (not document ID)
        // This matches how initializeMasterAccount creates documents (using UID as doc ID)
        const q = query(collection(db, 'admins'), where('email', '==', email), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const adminDoc = querySnapshot.docs[0];
            return { ...adminDoc.data(), id: adminDoc.id };
        }
        
        return null;
    } catch (error) {
        console.error(`Error getting admin by email ${email}:`, error);
        throw new Error(formatApiError(error));
    }
};

export const initializeMasterAccount = async (email, password) => {
    if (!isFirebaseReady()) {
        // Fallback for localStorage
        try {
            const admins = JSON.parse(localStorage.getItem('admins') || '{}');
            const adminId = email.replace(/[^a-zA-Z0-9]/g, '_');
            admins[adminId] = {
                email,
                role: 'master',
                permissions: ['all'],
                createdAt: new Date().toISOString(),
            };
            localStorage.setItem('admins', JSON.stringify(admins));
            return { success: true, message: 'Master account created locally.' };
        } catch (error) {
            return { success: false, message: 'Failed to create master account in local storage.' };
        }
    }

    try {
        // Step 1: Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const { user } = userCredential;

        // Step 2: Create admin document in Firestore
        const adminId = user.uid;
        const adminRef = doc(db, 'admins', adminId);

        await setDoc(adminRef, {
            email: user.email,
            uid: user.uid,
            role: 'master',
            permissions: ['all'], // Or a comprehensive list of all permissions
            createdAt: new Date().toISOString(),
        });

        return { success: true, message: 'Master account created successfully!' };
    } catch (error) {
        console.error("Error initializing master account:", error);
        return { success: false, message: formatApiError(error) };
    }
};

export const updateAdminLastLogin = async (adminId) => {
    if (!isFirebaseReady()) {
        try {
            const admins = JSON.parse(localStorage.getItem('admins') || '{}');
            const admin = Object.values(admins).find(a => a.uid === adminId);
            if (admin) {
                admin.lastLogin = new Date().toISOString();
                localStorage.setItem('admins', JSON.stringify(admins));
            }
        } catch (error) {
            console.error("Error updating admin last login in localStorage:", error);
        }
        return;
    }

    try {
        const adminRef = doc(db, 'admins', adminId);
        await updateDoc(adminRef, { lastLogin: serverTimestamp() });
    } catch (error) {
        console.error(`Error updating admin last login for ${adminId}:`, error);
        throw new Error(formatApiError(error));
    }
};

export const hasMasterAccount = async () => {
    if (!isFirebaseReady()) {
        try {
            const admins = JSON.parse(localStorage.getItem('admins') || '{}');
            return Object.values(admins).some(admin => admin.role === 'master');
        } catch (error) {
            console.error("Error checking for master account in localStorage:", error);
            return false;
        }
    }

    try {
        const q = query(collection(db, 'admins'), where('role', '==', 'master'), limit(1));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error("Error checking for master account:", error);
        throw new Error(formatApiError(error));
    }
};

export const createAdminAccount = async (adminData) => {
    if (!isFirebaseReady()) {
        try {
            const admins = JSON.parse(localStorage.getItem('admins') || '{}');
            const adminId = adminData.email.replace(/[^a-zA-Z0-9]/g, '_');
            admins[adminId] = { ...adminData, uid: adminId, createdAt: new Date().toISOString() };
            localStorage.setItem('admins', JSON.stringify(admins));
            return admins[adminId];
        } catch (error) {
            console.error("Error creating admin account in localStorage:", error);
            return null;
        }
    }

    try {
        // NOTE: This function creates a Firestore document with auto-generated ID.
        // For proper admin authentication, you should:
        // 1. First create Firebase Auth user
        // 2. Then call this with uid: authUser.uid to ensure document ID matches Auth UID
        // Otherwise, getAdminByEmail() will find the document but other lookups by UID may fail.
        
        // If uid is provided in adminData, use it as document ID
        const adminRef = adminData.uid 
            ? doc(db, 'admins', adminData.uid)
            : doc(collection(db, 'admins'));
        
        await setDoc(adminRef, { 
            ...adminData, 
            uid: adminRef.id, 
            createdAt: serverTimestamp() 
        });
        return { ...adminData, uid: adminRef.id };
    } catch (error) {
        console.error("Error creating admin account:", error);
        throw new Error(formatApiError(error));
    }
};

export const subscribeToAdmins = (callback, onError) => {
    if (!isFirebaseReady()) {
        try {
            const admins = JSON.parse(localStorage.getItem('admins') || '{}');
            callback(Object.values(admins));
        } catch (error) {
            if(onError) onError("Failed to retrieve admins from local storage.");
        }
        return () => {}; // No-op for localStorage
    }

    const q = query(collection(db, 'admins'));
    return onSnapshot(q, (snapshot) => {
        const admins = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        callback(admins);
    }, (error) => {
        console.error("Error subscribing to admins:", error);
        if(onError) onError(formatApiError(error));
    });
};

export const updateAdminAccount = async (adminId, data) => {
    if (!isFirebaseReady()) {
        try {
            const admins = JSON.parse(localStorage.getItem('admins') || '{}');
            if (admins[adminId]) {
                admins[adminId] = { ...admins[adminId], ...data };
                localStorage.setItem('admins', JSON.stringify(admins));
            }
        } catch (error) {
            console.error("Error updating admin account in localStorage:", error);
        }
        return;
    }

    try {
        const adminRef = doc(db, 'admins', adminId);
        await updateDoc(adminRef, data);
    } catch (error) {
        console.error(`Error updating admin account ${adminId}:`, error);
        throw new Error(formatApiError(error));
    }
};

export const deleteAdminAccount = async (adminId) => {
    if (!isFirebaseReady()) {
        try {
            const admins = JSON.parse(localStorage.getItem('admins') || '{}');
            delete admins[adminId];
            localStorage.setItem('admins', JSON.stringify(admins));
        } catch (error) {
            console.error("Error deleting admin account from localStorage:", error);
        }
        return;
    }

    try {
        // This only deletes the Firestore record. The Auth user must be deleted separately.
        const adminRef = doc(db, 'admins', adminId);
        await deleteDoc(adminRef);
    } catch (error) {
        console.error(`Error deleting admin account ${adminId}:`, error);
        throw new Error(formatApiError(error));
    }
};
