import { useState, ChangeEvent, FormEvent } from "react";
import "./App.css";
import axios from "axios";
import Cookies from "js-cookie";

interface User {
  email: string;
  password: string;
}

function App(): JSX.Element {
  const [user, setUser] = useState<User>({ email: "", password: "" });
  const [err, setErr] = useState<string>("");

  const refresh = (refreshToken: string): Promise<string | null> => {
    console.log("Refreshing token!");

    return new Promise((resolve, reject) => {
      axios
        .post<{ success: boolean; accessToken?: string }>(
          "http://localhost:5000/refresh",
          { refreshToken }
        )
        .then(({ data }) => {
          if (data.success === false) {
            setErr("Login again");
            resolve(null);
          } else {
            const { accessToken } = data;
            if (accessToken !== undefined) {
              Cookies.set("access", accessToken);
              resolve(accessToken);
            } else {
              setErr("Access token not provided");
              resolve(null);
            }
          }
        })
        .catch((error) => {
          console.error("Error refreshing token:", error);
          reject(error);
        });
    });
  };

  const requestLogin = async (
    accessToken: string,
    refreshToken: string
  ): Promise<boolean> => {
    console.log(accessToken, refreshToken);
    try {
      const { data } = await axios.post<{ success: boolean; message?: string }>(
        "http://localhost:5000/protected",
        {},
        { headers: { authorization: `Bearer ${accessToken}` } }
      );

      if (data.success === false) {
        if (data.message === "User not authenticated") {
          setErr("Login again");
        } else if (data.message === "Access token expired") {
          const newAccessToken = await refresh(refreshToken);
          if (newAccessToken) {
            return await requestLogin(newAccessToken, refreshToken);
          } else {
            return false;
          }
        }

        return false;
      } else {
        setErr("Protected route accessed!");
        return true;
      }
    } catch (error) {
      console.error("Error during login:", error);
      return false;
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    axios
      .post<{ accessToken: string; refreshToken: string }>(
        "http://localhost:5000/login",
        { email: user.email, password: user.password }
      )
      .then(({ data }) => {
        const { accessToken, refreshToken } = data;

        Cookies.set("access", accessToken);
        Cookies.set("refresh", refreshToken);
      })
      .catch((error) => {
        console.error("Error during login:", error);
        setErr("Login failed");
      });
  };

  const hasAccess = async (
    accessToken: string | undefined,
    refreshToken: string | undefined
  ): Promise<string | null> => {
    if (!refreshToken) return null;

    if (!accessToken) {
      const newAccessToken = await refresh(refreshToken);
      return newAccessToken || null;
    }

    return accessToken;
  };

  const protect = async (): Promise<void> => {
    let accessToken = Cookies.get("access");
    const refreshToken = Cookies.get("refresh");

    accessToken = (await hasAccess(accessToken, refreshToken)) ?? undefined;

    if (!accessToken) {
      setErr("Login again");
    } else {
      await requestLogin(accessToken, refreshToken || "");
    }
  };

  return (
    <div className="App">
      <form action="" onSubmit={handleSubmit}>
        <input
          name="email"
          type="email"
          placeholder="Email address"
          onChange={handleChange}
        />
        <br />
        <br />
        <input
          name="password"
          type="password"
          placeholder="Password"
          onChange={handleChange}
        />
        <br />
        <br />
        <input type="submit" value="Login" />
        <br />
        <br />
      </form>
      {err}
      <button onClick={protect}>Access Protected Content</button>
    </div>
  );
}

export default App;
