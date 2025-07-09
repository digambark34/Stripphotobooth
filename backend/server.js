require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const stripRoutes = require("./routes/stripRoutes");
const settingsRoutes = require("./routes/settingsRoutes");

// ✅ Fix: Set strictQuery AFTER mongoose import
mongoose.set('strictQuery', true);

// ✅ Check MONGO_URI
if (!process.env.MONGO_URI) {
  console.error("❌ Error: MONGO_URI not set in .env file");
  process.exit(1);
}

// ✅ MongoDB Atlas Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log("✅ MongoDB connected successfully"))
.catch((err) => {
  console.error("❌ MongoDB connection error:", err);
  process.exit(1);
});

// ✅ Initialize Express App
const app = express();

// ✅ Security Middleware with comprehensive CORS support
app.use(cors({
  origin: function (origin, callback) {
    console.log('🔍 CORS check for origin:', origin);

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('✅ CORS: Allowing request with no origin');
      return callback(null, true);
    }

    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = [
        'https://stripphotobooth.netlify.app',
        'https://strippphotobooth.netlify.app',
        process.env.FRONTEND_URL
      ].filter(Boolean);

      if (allowedOrigins.includes(origin) || origin.includes('.netlify.app')) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    } else {
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168.')) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // For legacy browser support
}));

// Additional CORS headers for extra compatibility
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log('📡 Request from origin:', origin);

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

// ✅ Body parsing with size limits
app.use(express.json({
  limit: "10mb",
  verify: (_req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ message: "Invalid JSON" });
      return;
    }
  }
}));



// ✅ Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ✅ API Routes
app.use("/api/strips", stripRoutes);
app.use("/api/settings", settingsRoutes);

// ✅ 404 Handler
app.use('*', (_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ✅ Global Error Handler
app.use((error, _req, res, _next) => {
  console.error('Global error handler:', error);
  res.status(error.status || 500).json({
    message: error.message || "Internal server error",
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});



// ✅ Start Backend Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ✅ Graceful Shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    console.log('✅ HTTP server closed');

    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ✅ Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});
