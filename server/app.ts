import express, {
  Request as ExpressRequest,
  Response,
  NextFunction,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { PrismaClient, User } from "@prisma/client";
import jwt from "jsonwebtoken";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

const prisma = new PrismaClient();

interface TokenPayload {
  user: User;
}

// Extend Request interface to include 'user' property
interface Request extends ExpressRequest {
  user?: TokenPayload;
}

// Middleware to authenticate user by verifying his/her jwt-token.
async function auth(req: Request, res: Response, next: NextFunction) {
  let token = req.headers["authorization"];
  if (!token || typeof token !== "string") {
    return res.status(403).json({ message: "Authorization header missing" });
  }
  token = token.split(" ")[1]; // Access token

  jwt.verify(token, "access", (err: any, decoded: any) => {
    if (err) {
      return res.json({
        success: false,
        message: "Access token expired",
      });
    }
    if (decoded) {
      const user = decoded.user as TokenPayload;
      req.user = user;
      next();
    } else {
      return res.status(403).json({ message: "User not authenticated" });
    }
  });
}

// Route to login user. (In this case, create a token);
app.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const accessToken = jwt.sign({ user: user }, "access", {
      expiresIn: "10s",
    });
    const refreshToken = jwt.sign({ email: user.email }, "refresh", {
      expiresIn: "7d",
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.json({ accessToken, refreshToken });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Protected route, can only be accessed when the user is logged in
app.post("/protected", auth, (req: Request, res: Response) => {
  try {
    return res.json({ message: "Protected content!" });
  } catch (error) {
    console.log("Error in protected Route", error);
    res.sendStatus(500).json("Error at Protected Route");
  }
});

app.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken || typeof refreshToken !== "string") {
    return res.json({ message: "Refresh token not found, login again" });
  }
  try {
    const user = await prisma.user.findFirst({ where: { refreshToken } });
    if (!user) {
      return res
        .sendStatus(403)
        .json({ message: "No user found, Try Log In Again" });
    }

    // Generate a new access token
    const accessToken = jwt.sign({ user: user }, "access", {
      expiresIn: "10s",
    });

    return res.json({ success: true, accessToken });
  } catch (error) {
    console.error("Error during token refresh:", error);
    return res.sendStatus(500).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
});

export default app;
