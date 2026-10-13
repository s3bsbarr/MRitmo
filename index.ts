import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

registerRootComponent(App);

// Home-screen widgets render and handle taps in headless JS, even with the app closed.
if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widgets/handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
