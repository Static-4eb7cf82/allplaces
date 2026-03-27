import { extendTheme } from "@mui/joy/styles";

export const theme = extendTheme({
  fontFamily: {
    body: "Inter, sans-serif",
    display: "Inter, sans-serif",
  },
  colorSchemes: {
    light: {
      palette: {
        // primary: {
        //   solidBg: "#005f73",
        //   solidHoverBg: "#0a9396",
        // },
      },
    },
    dark: {
      palette: {
        // primary: {
        //   solidBg: "#94d2bd",
        //   solidColor: "#001219",
        //   solidHoverBg: "#e9d8a6",
        // },
      },
    },
  },
});
