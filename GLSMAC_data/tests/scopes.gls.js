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
