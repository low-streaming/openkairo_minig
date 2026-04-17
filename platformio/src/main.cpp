#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <lvgl.h>
#include <WiFiManager.h>
#include "DisplayConfig.h"

// --- CONFIGURATION ---
const char* ha_url = "http://192.168.2.69:8123/api/openkairo_mining/data?display=1";

// --- GLOBALS ---
LGFX tft;
static const uint32_t screenWidth  = 480;
static const uint32_t screenHeight = 480;
static lv_display_t * disp;

// UI Data Structures
struct MiningData {
  float hashrate = 0;
  float power = 0;
  float btc_price = 0;
  int fee_low = 0;
  int fee_med = 0;
  int fee_high = 0;
  bool is_mining = false;
};
MiningData current_data;

// LVGL Labels
lv_obj_t * label_hashrate;
lv_obj_t * label_power;
lv_obj_t * label_btc;
lv_obj_t * label_fees;
lv_obj_t * led_mining;

// --- LVGL CALLBACKS ---
void my_disp_flush(lv_display_t *disp, const lv_area_t *area, uint8_t *px_map) {
  uint32_t w = (area->x2 - area->x1 + 1);
  uint32_t h = (area->y2 - area->y1 + 1);
  tft.pushImageDMA(area->x1, area->y1, w, h, (uint16_t *)px_map);
  lv_display_flush_ready(disp);
}

void my_touchpad_read(lv_indev_t *indev, lv_indev_data_t *data) {
  uint16_t touchX, touchY;
  bool touched = tft.getTouch(&touchX, &touchY);
  if (!touched) {
    data->state = LV_INDEV_STATE_RELEASED;
  } else {
    data->state = LV_INDEV_STATE_PRESSED;
    data->point.x = touchX;
    data->point.y = touchY;
  }
}

// --- DATA FETCHING ---
void fetchData() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(ha_url);
    int httpCode = http.GET();

    if (httpCode > 0) {
      String payload = http.getString();
      JsonDocument doc;
      deserializeJson(doc, payload);

      float h = 0;
      float p = 0;
      bool active = false;

      // Extract from "states"
      JsonObject states = doc["states"];
      for (JsonPair kv : states) {
        h += kv.value()["hashrate"].as<float>();
        p += kv.value()["power"].as<float>();
        if (kv.value()["is_mining"].as<bool>()) active = true;
      }

      current_data.hashrate = h;
      current_data.power = p;
      current_data.is_mining = active;

      // Mempool
      current_data.fee_low = doc["mempool"]["fees"]["hourFee"];
      current_data.fee_med = doc["mempool"]["fees"]["halfHourFee"];
      current_data.fee_high = doc["mempool"]["fees"]["fastestFee"];

      // Update UI Labels
      if(label_hashrate) lv_label_set_text_fmt(label_hashrate, "%.2f", current_data.hashrate);
      if(label_power) lv_label_set_text_fmt(label_power, "%.0f W", current_data.power);
      if(led_mining) {
        if (current_data.is_mining) lv_led_on(led_mining); else lv_led_off(led_mining);
      }
      if(label_fees) lv_label_set_text_fmt(label_fees, "FEES: %d / %d / %d sat/vB", current_data.fee_low, current_data.fee_med, current_data.fee_high);
    }
    http.end();
  }
}

// --- UI INITIALIZATION ---
void setupUI() {
  static lv_style_t style_main;
  lv_style_init(&style_main);
  lv_style_set_bg_color(&style_main, lv_color_hex(0x0a0a0c));

  lv_obj_t * screen = lv_screen_active();
  lv_obj_add_style(screen, &style_main, 0);

  // Header
  lv_obj_t * header = lv_label_create(screen);
  lv_label_set_text(header, "OPENKAIRO MINING");
  lv_obj_set_style_text_color(header, lv_color_hex(0x0bc4e2), 0);
  lv_obj_align(header, LV_ALIGN_TOP_MID, 0, 20);

  // Mining LED
  led_mining = lv_led_create(screen);
  lv_obj_set_size(led_mining, 15, 15);
  lv_obj_align(led_mining, LV_ALIGN_TOP_MID, 0, 50);
  lv_led_set_color(led_mining, lv_color_hex(0x0bc4e2));

  // Hashrate Card
  lv_obj_t * card = lv_obj_create(screen);
  lv_obj_set_size(card, 400, 180);
  lv_obj_align(card, LV_ALIGN_CENTER, 0, -20);
  lv_obj_set_style_bg_color(card, lv_color_hex(0x1a1a1f), 0);
  lv_obj_set_style_radius(card, 15, 0);
  lv_obj_set_style_border_width(card, 0, 0);

  lv_obj_t * l1 = lv_label_create(card);
  lv_label_set_text(l1, "TOTAL HASHRATE");
  lv_obj_set_style_text_color(l1, lv_color_hex(0x888888), 0);
  lv_obj_align(l1, LV_ALIGN_TOP_MID, 0, 10);

  label_hashrate = lv_label_create(card);
  lv_label_set_text(label_hashrate, "0.00");
  lv_obj_set_style_text_font(label_hashrate, &lv_font_montserrat_48, 0);
  lv_obj_align(label_hashrate, LV_ALIGN_CENTER, 0, 10);
  
  lv_obj_t * l2 = lv_label_create(card);
  lv_label_set_text(l2, "TH/s");
  lv_obj_set_style_text_color(l2, lv_color_hex(0x0bc4e2), 0);
  lv_obj_align(l2, LV_ALIGN_BOTTOM_MID, 0, -10);

  // Power
  label_power = lv_label_create(screen);
  lv_label_set_text(label_power, "0 W");
  lv_obj_align(label_power, LV_ALIGN_BOTTOM_LEFT, 60, -80);

  // Fees Footer
  label_fees = lv_label_create(screen);
  lv_label_set_text(label_fees, "FEES: ... sat/vB");
  lv_obj_set_style_text_color(label_fees, lv_color_hex(0x555555), 0);
  lv_obj_align(label_fees, LV_ALIGN_BOTTOM_MID, 0, -20);
}

// --- MAIN ---
void setup() {
  Serial.begin(115200);

  // 1. LCD & Touch
  tft.init();
  tft.setRotation(0);
  tft.setBrightness(128);

  // 2. LVGL
  lv_init();
  disp = lv_display_create(screenWidth, screenHeight);
  lv_display_set_flush_cb(disp, my_disp_flush);
  static lv_color_t *buf1 = (lv_color_t *)ps_malloc(screenWidth * 100 * sizeof(lv_color_t));
  lv_display_set_buffers(disp, buf1, NULL, screenWidth * 100 * sizeof(lv_color_t), LV_DISPLAY_RENDER_MODE_PARTIAL);

  lv_indev_t * indev = lv_indev_create();
  lv_indev_set_type(indev, LV_INDEV_TYPE_POINTER);
  lv_indev_set_read_cb(indev, my_touchpad_read);

  // 3. WiFi (WiFiManager AP)
  WiFiManager wm;
  //wm.resetSettings(); // Unlock this to clear saved WiFi
  bool res = wm.autoConnect("OpenKairo-Mining-Display", "12345678");

  if(!res) {
    Serial.println("Failed to connect or hit timeout");
    ESP.restart();
  } else {
    Serial.println("CONNECTED");
  }

  // 4. UI
  setupUI();
}

unsigned long lastUpdate = 0;
void loop() {
  lv_timer_handler();
  if (millis() - lastUpdate > 15000) {
    fetchData();
    lastUpdate = millis();
  }
  delay(5);
}
