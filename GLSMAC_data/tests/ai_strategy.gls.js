const strategy = #include('../default/game/ai/strategy');

const desired = strategy.get_desired_base_count;

test.assert(desired(1, 20, 10, 2) == 1);
test.assert(desired(6, 20, 10, 2) == 1);
test.assert(desired(7, 20, 10, 2) == 2);
test.assert(desired(13, 20, 10, 2) == 3);
test.assert(desired(19, 20, 10, 2) == 4);
test.assert(desired(100, 20, 10, 2) == 4);

test.assert(desired(100, 20, 10, 7) == 1);
test.assert(desired(100, 40, 20, 7) == 4);
test.assert(desired(100, 80, 40, 7) == 17);

test.assert(desired(0, 20, 10, 0) == 1);
