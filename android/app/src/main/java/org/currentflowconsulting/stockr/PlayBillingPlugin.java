package org.currentflowconsulting.stockr;

import android.app.Activity;
import androidx.annotation.NonNull;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {
  private BillingClient billingClient;
  private PluginCall pendingPurchase;

  private void withClient(PluginCall call, Runnable ready) {
    Activity activity = getActivity();
    if (activity == null) {
      call.reject("Play Billing needs the Android activity.");
      return;
    }
    if (billingClient != null && billingClient.isReady()) {
      ready.run();
      return;
    }
    billingClient =
        BillingClient.newBuilder(activity)
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build();
    billingClient.startConnection(
        new BillingClientStateListener() {
          @Override
          public void onBillingSetupFinished(@NonNull BillingResult result) {
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
              ready.run();
            } else {
              call.reject(result.getDebugMessage());
            }
          }

          @Override
          public void onBillingServiceDisconnected() {}
        });
  }

  @Override
  public void onPurchasesUpdated(@NonNull BillingResult result, List<Purchase> purchases) {
    PluginCall call = pendingPurchase;
    pendingPurchase = null;
    if (call == null) return;
    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
      call.reject(result.getDebugMessage() != null ? result.getDebugMessage() : "Purchase cancelled.");
      return;
    }
    Purchase purchase = purchases.get(0);
    if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED && !purchase.isAcknowledged()) {
      billingClient.acknowledgePurchase(
          AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build(),
          ack -> {});
    }
    call.resolve(purchaseObject(purchase));
  }

  private JSObject purchaseObject(Purchase purchase) {
    JSObject row = new JSObject();
    List<String> products = purchase.getProducts();
    row.put("productId", products.isEmpty() ? "" : products.get(0));
    row.put("purchaseToken", purchase.getPurchaseToken());
    return row;
  }

  @PluginMethod
  public void purchase(PluginCall call) {
    String productId = call.getString("productId", "");
    if (productId == null || productId.isEmpty()) {
      call.reject("A Play product is required.");
      return;
    }
    withClient(call, () -> queryAndLaunch(call, productId, BillingClient.ProductType.SUBS));
  }

  private void queryAndLaunch(PluginCall call, String productId, String type) {
    QueryProductDetailsParams params =
        QueryProductDetailsParams.newBuilder()
            .setProductList(
                Collections.singletonList(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(productId)
                        .setProductType(type)
                        .build()))
            .build();
    billingClient.queryProductDetailsAsync(
        params,
        (result, detailsResult) -> {
          List<ProductDetails> details =
              detailsResult != null ? detailsResult.getProductDetailsList() : new ArrayList<>();
          if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || details == null || details.isEmpty()) {
            if (BillingClient.ProductType.SUBS.equals(type)) {
              queryAndLaunch(call, productId, BillingClient.ProductType.INAPP);
              return;
            }
            call.reject("Play product was not found. Create stockr_pro / stockr_fleet in Play Console.");
            return;
          }
          ProductDetails product = details.get(0);
          BillingFlowParams.ProductDetailsParams.Builder productParams =
              BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product);
          List<ProductDetails.SubscriptionOfferDetails> offers = product.getSubscriptionOfferDetails();
          if (offers != null && !offers.isEmpty()) {
            productParams.setOfferToken(offers.get(0).getOfferToken());
          }
          pendingPurchase = call;
          getActivity()
              .runOnUiThread(
                  () -> {
                    BillingResult launch =
                        billingClient.launchBillingFlow(
                            getActivity(),
                            BillingFlowParams.newBuilder()
                                .setProductDetailsParamsList(Collections.singletonList(productParams.build()))
                                .build());
                    if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                      pendingPurchase = null;
                      call.reject(launch.getDebugMessage());
                    }
                  });
        });
  }

  @PluginMethod
  public void restore(PluginCall call) {
    withClient(
        call,
        () ->
            billingClient.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                (result, purchases) -> {
                  JSArray rows = new JSArray();
                  if (purchases != null) {
                    for (Purchase purchase : purchases) {
                      if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                        rows.put(purchaseObject(purchase));
                      }
                    }
                  }
                  JSObject payload = new JSObject();
                  payload.put("purchases", rows);
                  call.resolve(payload);
                }));
  }
}
