package expo.core;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.List;

// Shim to maintain compatibility with autolinking that imports
// expo.core.ExpoModulesPackage. Delegates to expo.modules.ExpoModulesPackage.
public class ExpoModulesPackage implements ReactPackage {
  private final expo.modules.ExpoModulesPackage delegate = new expo.modules.ExpoModulesPackage();

  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
    return delegate.createNativeModules(reactContext);
  }

  @Override
  @SuppressWarnings({"rawtypes", "unchecked"})
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    // Delegate returns List<ViewManager<?, ?>>; erase generics for Java signature.
    return (List) delegate.createViewManagers(reactContext);
  }
}
