const mongoose = require('mongoose');
const validator = require('validator');
const { toJSON, paginate } = require('./plugins');
const bcrypt = require('bcrypt');
const ApiError = require('../helpers/apiErrorConverter');

/* ================= USER ================= */
const userSchema = new mongoose.Schema(
  {
    // Basic Information
    fullName: {
      type: String,
      trim: true,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      required: true,
      index: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new ApiError('Invalid email', 400);
        }
      },
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      validate(value) {
        if (value && !/^[0-9]{10}$/.test(value)) {
          throw new ApiError('Phone number must be exactly 10 digits', 400);
        }
      },
    },
    role: {
      type: String,
      enum: ['admin', 'home-owner', 'apprentice', 'licensed-plumber'],
      default: 'home-owner',
    },

    password: {
      type: String,
      trim: true,
      minlength: 8,
      private: true,
      required: true,
    },

    profileimageurl: {
      type: String,
      default: '',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    fcmTokens: {
      type: [String],
      default: [],
    },
    isProfileCompleted: {
      type: Boolean,
      default: function () {
        const role = this.role || 'home-owner';
        if (role === 'licensed-plumber') {
          return false;
        }
        return true;
      },
    },
  },
  {
    timestamps: true,
  },
);

// Pre-query middleware to normalize email address to lowercase
const normalizeEmailQuery = function (next) {
  const query = this.getQuery();

  const lowercaseEmail = (val) => {
    if (typeof val === 'string') {
      return val.trim().toLowerCase();
    }
    if (val && typeof val === 'object') {
      if (typeof val.$eq === 'string') {
        val.$eq = val.$eq.trim().toLowerCase();
      }
      if (typeof val.$in === 'object' && Array.isArray(val.$in)) {
        val.$in = val.$in.map((v) =>
          typeof v === 'string' ? v.trim().toLowerCase() : v,
        );
      }
    }
    return val;
  };

  if (query.email) {
    query.email = lowercaseEmail(query.email);
  }

  if (query.$or && Array.isArray(query.$or)) {
    query.$or.forEach((cond) => {
      if (cond.email) {
        cond.email = lowercaseEmail(cond.email);
      }
    });
  }

  if (query.$and && Array.isArray(query.$and)) {
    query.$and.forEach((cond) => {
      if (cond.email) {
        cond.email = lowercaseEmail(cond.email);
      }
    });
  }

  next();
};

userSchema.pre('find', normalizeEmailQuery);
userSchema.pre('findOne', normalizeEmailQuery);
userSchema.pre('findOneAndUpdate', normalizeEmailQuery);
userSchema.pre('findOneAndDelete', normalizeEmailQuery);
userSchema.pre('countDocuments', normalizeEmailQuery);
userSchema.pre('updateOne', normalizeEmailQuery);
userSchema.pre('updateMany', normalizeEmailQuery);

// Indexes
userSchema.index({ email: 'text', phone: 'text' });

// Check if user password is matching
userSchema.methods.isPasswordMatch = async function (password) {
  const user = this;
  return bcrypt.compare(password, user.password);
};

// Hash the user password before saving data to db
userSchema.pre('save', async function (next) {
  const user = this;
  if (user.isModified('password')) {
    user.password = await bcrypt.hash(user.password, 8);
  }
  next();
});

// Login user
userSchema.statics.loginUser = async function (email, password) {
  const user = await this.findOne({ email });

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  if (!(await user.isPasswordMatch(password))) {
    throw new ApiError('Invalid email or password', 400);
  }

  return user;
};

// Find user by email or phone
userSchema.statics.findByEmailOrPhone = async function (identifier) {
  const user = await this.findOne({
    $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
  });
  return user;
};

// Virtuals
// userSchema.virtual('fullName').get(function () {
//   return `${this.firstName || ''} ${this.lastName || ''}`.trim();
// });

// userSchema.set('toObject', { virtuals: true });
// userSchema.set('toJSON', {
//   virtuals: true,
//   transform: function (doc, ret) {
//     delete ret.firstName;
//     delete ret.lastName;
//     return ret;
//   },
// });

userSchema.set('toObject', { virtuals: true });
userSchema.set('toJSON', { virtuals: true });

const User = mongoose.model('User', userSchema);

module.exports = User;
