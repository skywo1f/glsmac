let a = 1;
{
	{
		{
			a++;
		}
		let a = 5;
		{
			test.assert(a == 5);
			a = 10;
			test.assert(a == 10);
		}
		test.assert(a == 10);
	}
	test.assert(a++ == 2);
}
test.assert(a == 3);
{
	;
}

let loop_sum = 0;
for (loop_item of [1, 2, 3]) {
	loop_sum = loop_sum + loop_item;
}
test.assert(loop_sum == 6);
let loop_item_was_cleaned = false;
try {
	loop_item;
} catch {
	GSEReferenceError: (e) => {
		loop_item_was_cleaned = true;
	}
}
test.assert(loop_item_was_cleaned, 'for-of iterator leaked into its parent scope');

let shadowed_loop_item = 'outer';
let shadowed_values = [];
for (shadowed_loop_item of ['first', 'second']) {
	shadowed_values :+shadowed_loop_item;
}
test.assert(shadowed_values == ['first', 'second']);
test.assert(shadowed_loop_item == 'outer', 'for-of iterator replaced a shadowed variable');

let nested_values = [];
for (nested_loop_item of [1, 2]) {
	for (nested_loop_item of [3, 4]) {
		nested_values :+nested_loop_item;
	}
	nested_values :+nested_loop_item;
}
test.assert(nested_values == [3, 4, 1, 3, 4, 2]);

let throwing_loop_was_caught = false;
try {
	for (throwing_loop_item of [1]) {
		throw TestError('loop failed');
	}
} catch {
	TestError: (e) => {
		throwing_loop_was_caught = true;
	}
}
test.assert(throwing_loop_was_caught);
let throwing_loop_item_was_cleaned = false;
try {
	throwing_loop_item;
} catch {
	GSEReferenceError: (e) => {
		throwing_loop_item_was_cleaned = true;
	}
}
test.assert(throwing_loop_item_was_cleaned, 'throwing for-of iterator leaked into its parent scope');

let captured = 7;
let read_captured = null;
{
	const captured = 11;
	{
		read_captured = () => {
			return captured;
		};
	}
}
test.assert(captured == 7);
test.assert(read_captured() == 11);
{
	;
}
{
	;
}
