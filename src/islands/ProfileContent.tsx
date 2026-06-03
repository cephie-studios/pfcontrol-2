import "./loadIslandStyles";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../hooks/auth/AuthProvider";
import { DataProvider } from "../hooks/data/DataProvider";
import PilotProfile from "../pages/PilotProfile";
import { PostHogProviderWrapper } from "./PostHogProviderWrapper";

interface Props {
  username: string;
}

export default function ProfileContent({ username }: Props) {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            <PilotProfile standalone={false} usernameOverride={username} />
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}
