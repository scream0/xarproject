package com.mameko

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.mameko.data.local.TokenManager
import com.mameko.ui.auth.LoginScreen
import com.mameko.ui.home.HomeScreen

@Composable
fun MainNavigation() {
  val context = LocalContext.current
  val tokenManager = remember { TokenManager(context) }
  
  // Menggunakan "LOADING_STATE" sebagai penanda awal agar tidak berkedip ke halaman Login saat memuat token
  val token by tokenManager.getToken().collectAsState(initial = "LOADING_STATE")

  if (token == "LOADING_STATE") {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
      CircularProgressIndicator()
    }
    return
  }

  val startDestination = if (token.isNullOrEmpty()) Login else Main
  val backStack = rememberNavBackStack(startDestination)

  NavDisplay(
    backStack = backStack,
    onBack = { backStack.removeLastOrNull() },
    entryProvider =
      entryProvider {
        entry<Login> {
          LoginScreen(onLoginSuccess = { 
              backStack.removeLastOrNull() // remove login
              backStack.add(Main) 
          })
        }
        entry<Main> {
          HomeScreen(onLogout = {
              backStack.clear()
              backStack.add(Login)
          })
        }
      },
  )
}
