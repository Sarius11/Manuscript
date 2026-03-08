import "./styles/base.css";
import { TamaguiProvider, Theme } from "tamagui";
import { AppShell } from "./layout/AppShell";
import tamaguiConfig from "./styles/tamagui.config";

function App(): JSX.Element {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <Theme name="dark">
        <AppShell />
      </Theme>
    </TamaguiProvider>
  );
}

export default App;
