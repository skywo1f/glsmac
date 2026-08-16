SUBDIR( generator )
SUBDIR( module )
SUBDIR( tile )

SET( SRC ${SRC}

	${PWD}/Consts.cpp
	${PWD}/Map.cpp
	${PWD}/MapState.cpp
	${PWD}/OriginalMapLoader.cpp

	PARENT_SCOPE )
