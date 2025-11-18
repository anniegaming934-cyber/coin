// Toast.tsx
import toast from "react-hot-toast";

export const showToast = {
  success: (msg: string) => toast.success(msg),
  error: (msg: string) => toast.error(msg),
  info: (msg: string) =>
    toast(msg, {
      icon: "ℹ️",
      style: { background: "#0369a1", color: "#fff" },
    }),
  loading: (msg: string) => toast.loading(msg),
};
