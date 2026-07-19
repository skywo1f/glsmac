return (game) => {

	for (e of [
		'define_resource',
		'define_no_resource',
		'define_animation',
		'define_moraleset',
		'define_unit',
		'game_settings',
		'select_faction',
		'ready_or_not',
		'spawn_unit',
		'despawn_unit',
		'move_unit',
		'attack_unit',
		'advance_unit_after_combat',
		'unit_skip_turn',
		'define_base_pop',
		'spawn_base',
		'add_base_pop',
		'remove_base_pop',
		'process_base_growth',
		'complete_turn',
		'uncomplete_turn',
		'advance_turn',
		'chat_message',
		'work_base_tile',
		'unwork_base_tile',
	]) {
		game.register_event(e, #include('event/' + e));
	}

};
