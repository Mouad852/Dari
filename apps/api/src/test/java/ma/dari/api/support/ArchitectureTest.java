package ma.dari.api.support;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaMethodCall;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import org.springframework.data.jpa.repository.Query;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * Rules that are easy to state, easy to violate accidentally, and expensive to
 * discover by review three months later.
 *
 * <p>Four rules, and this list is the whole set:
 *
 * <ol>
 *   <li>a user controller never reaches into {@code UserRepository};</li>
 *   <li>{@code common.pagination} stays independent of every feature;</li>
 *   <li>no {@code @Query} outside {@code ma.dari.api.listing} reads the
 *       {@code listings} table or the {@code Listing} entity, and no class
 *       outside it touches {@code ListingSearchRepository} — so the
 *       {@code status = PUBLISHED AND availability_state = AVAILABLE} invariant
 *       cannot be forgotten in a new feature. Reading the
 *       {@code published_listings} view is exactly how that invariant is
 *       honoured, so it stays allowed;</li>
 *   <li>the coordinate chokepoint: no class outside {@code ma.dari.api.listing}
 *       reads {@code Listing.getLatitude()}/{@code getLongitude()} or builds a
 *       public listing DTO, and each of those DTOs is built by a {@code from}
 *       factory that takes the fuzzed {@code double[]}. Together that leaves
 *       one package able to put a coordinate in front of the public, and one
 *       way for it to do so — through {@code LocationFuzzer}.</li>
 * </ol>
 */
@AnalyzeClasses(
        packages = "ma.dari.api",
        importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    private static final String LISTING_PACKAGE = "ma.dari.api.listing..";

    /** The three DTOs that carry a coordinate to an anonymous caller. */
    private static final Set<String> PUBLIC_LISTING_DTOS = Set.of(
            "ma.dari.api.listing.PublicListingResponse",
            "ma.dari.api.listing.PublicListingDetailResponse",
            "ma.dari.api.listing.MapPinResponse");

    private static final DescribedPredicate<JavaClass> PUBLIC_LISTING_DTO =
            new DescribedPredicate<>("a public listing DTO") {
                @Override
                public boolean test(JavaClass type) {
                    return PUBLIC_LISTING_DTOS.contains(type.getFullName());
                }
            };

    /** Entities are never serialized to clients; every response is an explicit DTO. */
    @ArchTest
    static final ArchRule controllersDoNotReturnEntities = noClasses()
            .that().resideInAPackage("..user..")
            .and().haveSimpleNameEndingWith("Controller")
            .should().accessClassesThat().haveSimpleName("UserRepository")
            .because("controllers go through services; repositories are not a controller concern");

    /** Feature packages stay independent of each other's internals. */
    @ArchTest
    static final ArchRule commonDependsOnNoFeature = noClasses()
            .that().resideInAPackage("..common.pagination..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "..listing..", "..messaging..", "..moderation..")
            .because("shared primitives must not know about features that use them");

    /**
     * The visibility invariant, as a build failure.
     *
     * <p>Every query that reads listing rows for the public lives in
     * {@code ListingSearchRepository} and goes through {@code published_listings},
     * the view that applies {@code status = PUBLISHED AND availability_state =
     * AVAILABLE}. A new feature that writes its own {@code FROM listings} query
     * elsewhere silently republishes suspended, expired and deleted rows.
     */
    @ArchTest
    static final ArchRule onlyTheListingPackageQueriesTheListingsTable = noClasses()
            .that().resideOutsideOfPackage(LISTING_PACKAGE)
            .should(declareAQueryAgainstTheListingsTable())
            .because("the published_listings view is what applies the public-visibility filter");

    @ArchTest
    static final ArchRule theSearchRepositoryStaysInsideTheListingPackage = noClasses()
            .that().resideOutsideOfPackage(LISTING_PACKAGE)
            .should().dependOnClassesThat().haveFullyQualifiedName("ma.dari.api.listing.ListingSearchRepository")
            .because("every published_listings query lives there, and that is the point");

    /**
     * The coordinate chokepoint (audit P0-1).
     *
     * <p>A raw {@code Listing} carries the exact address. Only the listing
     * package may read it, and only it may build the DTOs that publish a
     * coordinate — which take the fuzzed pair, never the listing's own.
     */
    @ArchTest
    static final ArchRule exactCoordinatesStayInsideTheListingPackage = noClasses()
            .that().resideOutsideOfPackage(LISTING_PACKAGE)
            .should().callMethodWhere(readsAListingCoordinate())
            .because("an exact coordinate leaves this package only through LocationFuzzer");

    @ArchTest
    static final ArchRule publicListingDtosAreBuiltInsideTheListingPackage = noClasses()
            .that().resideOutsideOfPackage(LISTING_PACKAGE)
            .should().callCodeUnitWhere(buildsAPublicListingDto())
            .because("the fuzzing call site belongs with the coordinates it fuzzes");

    @ArchTest
    static final ArchRule publicListingDtosTakeTheFuzzedCoordinates = classes()
            .that(PUBLIC_LISTING_DTO)
            .should(beBuiltFromAFuzzedPair())
            .because("a factory taking latitude and longitude directly would make the fuzzer optional");

    private static ArchCondition<JavaClass> declareAQueryAgainstTheListingsTable() {
        return new ArchCondition<>("declare a query that reads the listings table") {
            @Override
            public void check(JavaClass type, ConditionEvents events) {
                for (JavaMethod method : type.getMethods()) {
                    Optional<Query> query = method.tryGetAnnotationOfType(Query.class);
                    if (query.isEmpty()) {
                        continue;
                    }
                    for (String statement : List.of(query.get().value(), query.get().countQuery())) {
                        if (readsTheListingsTable(statement)) {
                            events.add(SimpleConditionEvent.satisfied(type,
                                    method.getFullName() + " queries the listings table: " + statement.strip()));
                        }
                    }
                }
            }
        };
    }

    /** The view is the sanctioned path, so it is removed before the table name is looked for. */
    private static boolean readsTheListingsTable(String statement) {
        String withoutTheView = statement.replace("published_listings", "");
        return Pattern.compile("\\blistings\\b", Pattern.CASE_INSENSITIVE).matcher(withoutTheView).find()
                || Pattern.compile("\\bListing\\b").matcher(withoutTheView).find();
    }

    private static DescribedPredicate<JavaMethodCall> readsAListingCoordinate() {
        return new DescribedPredicate<>("a call to Listing.getLatitude() or Listing.getLongitude()") {
            @Override
            public boolean test(JavaMethodCall call) {
                return call.getTargetOwner().getFullName().equals("ma.dari.api.listing.Listing")
                        && (call.getName().equals("getLatitude") || call.getName().equals("getLongitude"));
            }
        };
    }

    private static DescribedPredicate<com.tngtech.archunit.core.domain.JavaCall<?>> buildsAPublicListingDto() {
        return new DescribedPredicate<>("a call that builds a public listing DTO") {
            @Override
            public boolean test(com.tngtech.archunit.core.domain.JavaCall<?> call) {
                return PUBLIC_LISTING_DTOS.contains(call.getTargetOwner().getFullName());
            }
        };
    }

    private static ArchCondition<JavaClass> beBuiltFromAFuzzedPair() {
        return new ArchCondition<>("have a static from(...) taking the fuzzed double[]") {
            @Override
            public void check(JavaClass type, ConditionEvents events) {
                boolean fuzzed = type.getMethods().stream()
                        .filter(method -> method.getName().equals("from"))
                        .filter(method -> method.getModifiers().contains(com.tngtech.archunit.core.domain.JavaModifier.STATIC))
                        .anyMatch(method -> method.getRawParameterTypes().stream()
                                .anyMatch(parameter -> parameter.isArray()
                                        && parameter.getComponentType().getName().equals("double")));
                events.add(new SimpleConditionEvent(type, fuzzed,
                        fuzzed
                                ? type.getName() + " is built from a fuzzed double[]"
                                : type.getName() + " has no static from(...) taking a fuzzed double[]"));
            }
        };
    }
}
