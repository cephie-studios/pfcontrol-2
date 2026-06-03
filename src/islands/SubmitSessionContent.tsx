import "./loadIslandStyles";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../hooks/auth/AuthProvider";
import { DataProvider } from "../hooks/data/DataProvider";
import { SettingsProvider } from "../hooks/settings/SettingsProvider";
import Submit from "../pages/Submit";
import { PostHogProviderWrapper } from "./PostHogProviderWrapper";

interface SubmitSessionContentProps {
  airportIcao?: string;
}

export default function SubmitSessionContent({
  airportIcao,
}: SubmitSessionContentProps) {
  return (
    <PostHogProviderWrapper>
      <AuthProvider>
        <DataProvider>
          <SettingsProvider>
            <BrowserRouter>
              <Routes>
                <Route
                  path="/submit/:sessionId"
                  element={
                    <Submit
                      standalone={false}
                      initialAirportIcao={airportIcao}
                    />
                  }
                />
              </Routes>
            </BrowserRouter>
          </SettingsProvider>
        </DataProvider>
      </AuthProvider>
    </PostHogProviderWrapper>
  );
}
