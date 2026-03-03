import { useState, useCallback } from "react";
import {
  getNotificationConfig,
  saveNotificationConfig,
} from "../services/notificationConfigStore.ts";
import {
  isNotificationSupported,
  hasNotificationPermission,
  requestNotificationPermission,
  isIOSDevice,
  checkAndNotifyTasks,
} from "../services/notifications.ts";

export type NotificationState = {
  supported: boolean;
  permitted: boolean;
  enabled: boolean;
  dismissed: boolean;
  isIOS: boolean;
  enable: () => Promise<boolean>;
  disable: () => void;
  dismissPrompt: () => void;
  resetPrompt: () => void;
  checkTasks: () => Promise<number>;
};

export function useNotifications(): NotificationState {
  const [config, setConfig] = useState(() => getNotificationConfig());

  const supported = isNotificationSupported();
  const permitted = hasNotificationPermission();
  const isIOS = isIOSDevice();


  const enable = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    const permission = await requestNotificationPermission();
    if (permission !== "granted") return false;
    const updated = saveNotificationConfig({ enabled: true, dismissed: false });
    setConfig(updated);
    return true;
  }, [supported]);

  const disable = useCallback(() => {
    const updated = saveNotificationConfig({ enabled: false });
    setConfig(updated);
  }, []);

  const dismissPrompt = useCallback(() => {
    const updated = saveNotificationConfig({ dismissed: true });
    setConfig(updated);
  }, []);

  const resetPrompt = useCallback(() => {
    const updated = saveNotificationConfig({
      enabled: false,
      dismissed: false,
    });
    setConfig(updated);
  }, []);

  const checkTasks = useCallback(async (): Promise<number> => {
    return checkAndNotifyTasks();
  }, []);

  return {
    supported,
    permitted,
    enabled: config.enabled,
    dismissed: config.dismissed,
    isIOS,
    enable,
    disable,
    dismissPrompt,
    resetPrompt,
    checkTasks,
  };
}
