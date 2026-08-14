const first = #monotonic_ms();
let total = 0;
for (let i = 0; i < 1000; i++) {
	total += i;
}
const second = #monotonic_ms();

test.assert(#typeof(first) == 'Int');
test.assert(second >= first);
test.assert(total == 499500);
