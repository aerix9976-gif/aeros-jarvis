# Optional Activate Aero AI wake-word model

Place the Android-targeted custom Picovoice Porcupine keyword model here with the exact filename:

`aero-activate-android.ppn`

Train/download the model for **Android** using the phrase `Activate Aero AI` in Picovoice Console. The app does not include a model or AccessKey by default. Do not commit your AccessKey. Enter it in Aero's Config screen when you intentionally start wake-word listening. The key is passed in memory to the foreground service and is not saved by Aero.

Wake-word detection runs locally, but Porcupine requires an AccessKey and its initialization may need internet access for authorization. After detection, Aero pauses wake listening and opens tap-to-talk only if the app is visible. A persistent Android notification stays visible while the wake service is active; it includes a Stop action.

The count-only notification listener is a separate optional system permission. It reads the number of active notifications only and deliberately never accesses notification titles or message content.