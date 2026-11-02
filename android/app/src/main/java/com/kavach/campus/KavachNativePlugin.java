package com.kavach.campus;

import androidx.activity.OnBackPressedCallback;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Kavach's own native features:
 *  - the system fingerprint prompt (BiometricPrompt) for login and for unlocking the ID,
 *  - the back button / back gesture, sent to the web app so it can close a sheet or
 *    go back a page instead of quitting,
 *  - moving the app to the background (what "back" does on the home screen).
 */
@CapacitorPlugin(name = "KavachNative")
public class KavachNativePlugin extends Plugin {

    private static final int AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_STRONG
        | BiometricManager.Authenticators.BIOMETRIC_WEAK;

    @Override
    public void load() {
        getActivity()
            .getOnBackPressedDispatcher()
            .addCallback(
                getActivity(),
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        if (hasListeners("backButton")) {
                            notifyListeners("backButton", new JSObject());
                        } else {
                            // the web app is not listening yet: behave like a launcher app
                            getActivity().moveTaskToBack(true);
                        }
                    }
                }
            );
    }

    @PluginMethod
    public void biometricStatus(PluginCall call) {
        int code = BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS);
        JSObject ret = new JSObject();
        ret.put("available", code == BiometricManager.BIOMETRIC_SUCCESS);
        String reason = "ok";
        if (code == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) reason = "none-enrolled";
        else if (code == BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE) reason = "no-hardware";
        else if (code != BiometricManager.BIOMETRIC_SUCCESS) reason = "unavailable";
        ret.put("reason", reason);
        call.resolve(ret);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        String title = call.getString("title", "Unlock Kavach");
        String subtitle = call.getString("subtitle", "Touch the fingerprint sensor");
        String cancel = call.getString("cancel", "Use password");
        getActivity()
            .runOnUiThread(() -> {
                FragmentActivity activity = getActivity();
                BiometricPrompt prompt = new BiometricPrompt(
                    activity,
                    ContextCompat.getMainExecutor(activity),
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            JSObject ret = new JSObject();
                            ret.put("ok", true);
                            call.resolve(ret);
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, CharSequence errString) {
                            String code = "error";
                            if (errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON) code = "password";
                            else if (errorCode == BiometricPrompt.ERROR_USER_CANCELED || errorCode == BiometricPrompt.ERROR_CANCELED) code = "cancelled";
                            else if (errorCode == BiometricPrompt.ERROR_LOCKOUT || errorCode == BiometricPrompt.ERROR_LOCKOUT_PERMANENT) code = "lockout";
                            call.reject(errString.toString(), code);
                        }
                        // onAuthenticationFailed (finger not recognised): the prompt stays open for another try
                    }
                );
                BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setNegativeButtonText(cancel)
                    .setAllowedAuthenticators(AUTHENTICATORS)
                    .setConfirmationRequired(false)
                    .build();
                prompt.authenticate(info);
            });
    }

    @PluginMethod
    public void minimize(PluginCall call) {
        getActivity().moveTaskToBack(true);
        call.resolve();
    }
}
