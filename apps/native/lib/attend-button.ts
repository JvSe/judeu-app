import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";

const KEY = "judeu.hideAttendButton";

export function useAttendButtonVisibility() {
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(KEY)
      .then((value) => {
        if (alive) setHidden(value === "1");
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const hide = useCallback(async () => {
    await SecureStore.setItemAsync(KEY, "1");
    setHidden(true);
  }, []);

  const show = useCallback(async () => {
    await SecureStore.deleteItemAsync(KEY);
    setHidden(false);
  }, []);

  return { hidden, ready, hide, show };
}
