export const stitchUiHtml = {
  splash_loading_screen: require('../assets/stitch_ui/splash_loading_screen/code.html'),
  welcome_screen: require('../assets/stitch_ui/welcome_screen/code.html'),
  home_play_hub: require('../assets/stitch_ui/home_play_hub/code.html'),
  create_room_screen: require('../assets/stitch_ui/create_room_screen/code.html'),
  join_room_screen: require('../assets/stitch_ui/join_room_screen/code.html'),
  lobby_screen: require('../assets/stitch_ui/lobby_screen/code.html'),
  role_reveal_screen: require('../assets/stitch_ui/role_reveal_screen/code.html'),
  gameplay_screen: require('../assets/stitch_ui/gameplay_screen/code.html'),
  guess_picker_bottom_sheet: require('../assets/stitch_ui/guess_picker_bottom_sheet/code.html'),
  round_result_screen: require('../assets/stitch_ui/round_result_screen/code.html'),
  scoreboard_screen: require('../assets/stitch_ui/scoreboard_screen/code.html'),
  profile_settings_screen: require('../assets/stitch_ui/profile_settings_screen/code.html'),
  category_packs_screen: require('../assets/stitch_ui/category_packs_screen/code.html'),
  report_block_screen: require('../assets/stitch_ui/report_block_screen/code.html'),
  end_game_screen: require('../assets/stitch_ui/end_game_screen/code.html')
} as const;

export type StitchUiHtmlKey = keyof typeof stitchUiHtml;
