package com.adamantium.aicore;

import android.content.Context;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.*;
import java.io.IOException;

/** Persisted SAF handles to model artifacts; no eager weights read or memory copies. */
final class ModelRegistry {
    private static final String PREF = "ai_core_model_registry_v1";
    private static final String KEY = "artifacts";
    private static final Set<String> FORMATS = new HashSet<>(Arrays.asList(
        "gguf","safetensors","onnx","genesis","genome","bin"));
    private static JSONArray snapshot(Context c) throws Exception {
        return new JSONArray(c.getSharedPreferences(PREF,Context.MODE_PRIVATE).getString(KEY,"[]"));
    }
    static synchronized JSONObject importModel(Context c, Uri uri, int flags) throws Exception {
        if (!"content".equalsIgnoreCase(uri.getScheme()))
            throw new SecurityException("Only SAF content handles are accepted");
        if ((flags & Intent.FLAG_GRANT_READ_URI_PERMISSION)==0)
            throw new SecurityException("Read permission missing");
        String filename=null;
        long declaredSize=-1;
        try (Cursor cursor = c.getContentResolver().query(uri,
            new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE},null,null,null)) {
            if (cursor!=null && cursor.moveToFirst()) {
                filename=cursor.getString(0);
                if (!cursor.isNull(1)) declaredSize=cursor.getLong(1);
            }
        }
        if (filename==null || !filename.contains("."))
            throw new IllegalArgumentException("Model filename/format missing");
        String suffix=filename.substring(filename.lastIndexOf('.')+1).toLowerCase(Locale.ROOT);
        if (!FORMATS.contains(suffix))
            throw new IllegalArgumentException("Unsupported model artifact extension");
        if (declaredSize==0) throw new IllegalArgumentException("Empty model artifact");
        try (ParcelFileDescriptor fd = c.getContentResolver().openFileDescriptor(uri,"r")) {
            if (fd==null) throw new IOException("Cannot open model artifact");
        }
        // Persist only user-approved file handles: never grant the entire filesystem.
        c.getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);
        JSONArray all=snapshot(c);
        for (int i=0;i<all.length();i++) {
            JSONObject existing=all.getJSONObject(i);
            if (uri.toString().equals(existing.optString("uri"))) return existing;
        }
        JSONObject model = new JSONObject().put("id",UUID.randomUUID().toString())
            .put("name",filename).put("format",suffix).put("sizeBytes",declaredSize)
            .put("uri",uri.toString()).put("status","registered-not-loaded");
        all.put(model);
        c.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit().putString(KEY,all.toString()).apply();
        return model;
    }
    static synchronized JSONArray list(Context c) throws Exception {
        JSONArray result=new JSONArray(), all=snapshot(c);
        for(int i=0;i<all.length();i++) {
            JSONObject m=all.getJSONObject(i);
            result.put(new JSONObject().put("id",m.getString("id"))
                .put("name",m.getString("name")).put("format",m.getString("format"))
                .put("sizeBytes",m.optLong("sizeBytes",-1))
                .put("status","registered-not-loaded"));
        }
        return result;
    }
    /** Native model providers may consume the FD; callers own and must close it. */
    static ParcelFileDescriptor open(Context c,String id) throws Exception {
        JSONArray all=snapshot(c);
        for(int i=0;i<all.length();i++) {
            JSONObject m=all.getJSONObject(i);
            if(m.getString("id").equals(id)) {
                ParcelFileDescriptor fd=c.getContentResolver()
                    .openFileDescriptor(Uri.parse(m.getString("uri")),"r");
                if(fd==null) throw new IOException("Model file no longer available");
                return fd;
            }
        }
        throw new IllegalArgumentException("Unknown model id");
    }
}
