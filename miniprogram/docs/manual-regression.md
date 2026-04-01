# Miniprogram Manual Regression Checks

This file tracks user-facing checks for flows that are not yet covered by automated regression.

## Mine Page Auth Flow

### Preconditions

- Open the mini program to the `我的` tab.
- Make sure the page can complete a normal login flow.

### Checks

1. When logged out, the profile card shows `立即登录`.
2. Tap the profile card while logged out.
3. Confirm the login sheet appears.
4. Complete login successfully.
5. Confirm the login sheet closes and the profile card shows the logged-in nickname.
6. Tap `退出登录`.
7. Confirm the page stays on the `我的` tab in the logged-out state.
8. Confirm a success toast appears with `已退出登录`.
9. Confirm the login sheet does not reopen automatically after logout.
10. Tap the profile card again after logout.
11. Confirm the login sheet appears only after this explicit tap.

### Expected Result

- Logout clears the current login state immediately.
- The page refreshes to the logged-out view without opening the login sheet on its own.
- The login sheet is only shown when the user explicitly taps to log in again.
