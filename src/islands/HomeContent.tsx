import "./loadIslandStyles";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../hooks/auth/AuthProvider";
import { SettingsProvider } from "../hooks/settings/SettingsProvider";
import Home from "../pages/Home";
import { PostHogProviderWrapper } from "./PostHogProviderWrapper";

export default function HomeContent() {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
            <Home standalone={false} />
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}
