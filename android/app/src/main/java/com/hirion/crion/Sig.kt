package com.hirion.crion

// 업데이트 목록 서명 확인 (컴퓨터판 updater.verifySig 와 같음: Ed25519, 공개 열쇠는 PEM)
//  안드로이드 13(API 33)부터 기본으로 Ed25519 를 확인할 수 있다. 그보다 낮으면 확인할 수 없으니 false (= 업데이트 안 받음)

import android.os.Build
import android.util.Base64
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.X509EncodedKeySpec

object Sig {
    fun verify(bytes: ByteArray, sigB64: String, pubPem: String): Boolean {
        if (Build.VERSION.SDK_INT < 33) return false
        return try {
            val der = Base64.decode(pubPem.replace(Regex("-----[^-]+-----"), "").replace(Regex("\\s"), ""), Base64.DEFAULT)
            val key = KeyFactory.getInstance("Ed25519").generatePublic(X509EncodedKeySpec(der))
            val s = Signature.getInstance("Ed25519")
            s.initVerify(key)
            s.update(bytes)
            s.verify(Base64.decode(sigB64, Base64.DEFAULT))
        } catch (e: Exception) { false }
    }
}
