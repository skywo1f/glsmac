#pragma once

#include "gc/Object.h"

#include "gse/value/Callable.h"

namespace game {
namespace backend {
namespace event {

class EventHandler : public gc::Object {
public:
	EventHandler(
		gc::Space* const gc_space, const std::string& name,
		gse::value::Callable* const validate,
		gse::value::Callable* const resolve,
		gse::value::Callable* const apply,
		gse::value::Callable* const rollback,
		const bool private_unit_event,
		const bool unit_snapshot_event,
		const bool private_player_event
	);

	void GetReachableObjects( std::unordered_set< Object* >& reachable_objects ) override;

	const std::string* const Validate( GSE_CALLABLE, const gse::value::function_arguments_t& args ) const;
	const bool HasResolve() const;
	const bool IsPrivateUnitEvent() const;
	const bool IsUnitSnapshotEvent() const;
	const bool IsPrivatePlayerEvent() const;
	gse::Value* const Resolve( GSE_CALLABLE, const gse::value::function_arguments_t& args ) const;
	gse::Value* const Apply( GSE_CALLABLE, const gse::value::function_arguments_t& args ) const;
	void Rollback( GSE_CALLABLE, const gse::value::function_arguments_t& args ) const;

private:
	const std::string m_name;
	gse::value::Callable* m_validate;
	gse::value::Callable* m_resolve;
	gse::value::Callable* m_apply;
	gse::value::Callable* m_rollback;
	const bool m_private_unit_event;
	const bool m_unit_snapshot_event;
	const bool m_private_player_event;

};

}
}
}
