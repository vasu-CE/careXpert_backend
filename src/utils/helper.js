import { ApiError } from "./ApiError.js";

export const isAdmin = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json(new ApiError(403, "Unautorized request"));
  }
  next();
};

export const isStudent = (req, res, next) => {
  if (req.user.role !== "STUDENT") {
    return res.status(403).json(new ApiError(403, "Unautorized request"));
  }
  next();
};

export const isHead = (req, res, next) => {
  if (req.user.role !== "HEAD") {
    return res.status(403).json(new ApiError(403, "Unautorized request"));
  }
  next();
};

export const isPrincipal = (req, res, next) => {
  if (req.user.role !== "PRINCIPAL") {
    return res.status(403).json(new ApiError(403, "Unautorized request"));
  }
  next();
};

export const isDean = (req, res, next) => {
  if (req.user.role !== "DEAN") {
    return res.status(403).json(new ApiError(403, "Unautorized request"));
  }
  next();
};

export const formatDate = (dateString) => {
  // Handle both DD-MM-YYYY and D-M-YYYY formats
  console.log(dateString);
  const [year, month, day] = dateString.split("-");

  // Pad day and month with leading zeros if needed
  const paddedDay = day.padStart(2, "0");
  const paddedMonth = month.padStart(2, "0");

  // Create date in YYYY-MM-DD format and convert to ISO string
  const isoDate = new Date(`${year}-${paddedMonth}-${paddedDay}`).toISOString();

  return isoDate;
};

export const isCounsellor = (req, res, next) => {
  if (req.user.role !== "COUNSELLOR") {
    return res.status(403).json(new ApiError(403, "Unautorized request"));
  }
  next();
};

export const isFacultyAdmin = (req, res, next) => {

  if (req.user.role === "COUNSELLOR" && req.user.isAdmin) {
    next();
  } else {
    return res.status(403).json(new ApiError(403, "Unautorized request"));
  }
};

export const ReportAccess = (req, res, next) => {
  console.log(req.user);
  if (req.user.role === "HEAD" || req.user.role === "COUNSELLOR") {
    next();
  } else {
    return res.status(403).json(new ApiError(403, "Unautorized request"));
  }
};

export const PrincipalAdminAccess = (req, res, next) => {
  // console.log(req.user);
  if (req.user.role === "PRINCIPAL" || req.user.role === "ADMIN") {
    next();
  } else {
    return res.status(403).json(new ApiError(403, "Unautorized request"));
  }
};


// Add this to your helpers.js file

/**
 * Generate a random password of specified length
 * @param {number} length - Length of the password
 * @returns {string} - Generated password
 */
export const generateRandomPassword = (length = 12) => {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";

  // Ensure at least one character from each category
  password += charset.charAt(Math.floor(Math.random() * 26)); // Uppercase
  password += charset.charAt(26 + Math.floor(Math.random() * 26)); // Lowercase
  password += charset.charAt(52 + Math.floor(Math.random() * 10)); // Number
  password += charset.charAt(62 + Math.floor(Math.random() * 8)); // Special char

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset.charAt(randomIndex);
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
};

/**
 * Generate a random token for verification
 * @returns {string} - Generated token
 */
export const generateToken = () => {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
};
