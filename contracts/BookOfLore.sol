// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol';

/**
 * @title The Book of Lore
 */
contract BookOfLore is Ownable, EIP712 {
    address public wizardsContractAddress;

    struct Lore {
        address creator;
        uint256 parentLoreId;
        bool nsfw;
        bool struck;
        string loreMetadataURI;
    }

    mapping(uint256 => Lore[]) public wizardLore;
    Lore[] public narrative;

    event LoreAdded(uint256 wizardId, uint256 loreIdx);
    event LoreUpdated(uint256 wizardId, uint256 loreIdx);
    event LoreStruck(uint256 wizardId, uint256 loreIdx);
    event NarrativeAdded(uint256 loreIdx);
    event NarrativeUpdated(uint256 loreIdx);

    constructor(address _wizardsContractAddress) EIP712('BookOfLore', '1') {
        wizardsContractAddress = _wizardsContractAddress;
    }

    function numLore(uint256 wizardId) public view returns (uint256) {
        return wizardLore[wizardId].length;
    }

    function numNarrative() public view returns (uint256) {
        return narrative.length;
    }

    function loreFor(uint256 wizardId) public view returns (Lore[] memory) {
        return wizardLore[wizardId];
    }

    function loreAt(
        uint256 wizardId,
        uint256 startIdx,
        uint256 endIdx
    ) public view returns (Lore[] memory) {
        Lore[] memory l = new Lore[](endIdx - startIdx + 1);
        uint256 length = endIdx - startIdx + 1;

        for (uint256 i = 0; i < length; i++) {
            l[i] = wizardLore[wizardId][startIdx + i];
        }
        return l;
    }

    function narrativeAt(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (Lore[] memory)
    {
        Lore[] memory l = new Lore[](endIdx - startIdx + 1);
        uint256 length = endIdx - startIdx + 1;

        for (uint256 i = 0; i < length; i++) {
            l[i] = narrative[startIdx + i];
        }
        return l;
    }

    function addNarrative(
        uint256 parentLoreId,
        bool nsfw,
        string memory loreMetadataURI
    ) public {
        require(
            owner() == _msgSender(),
            'Ownable: caller is not the Lore Master'
        );
        narrative.push(
            Lore(_msgSender(), parentLoreId, nsfw, false, loreMetadataURI)
        );
        emit NarrativeAdded(narrative.length - 1);
    }

    function updateNarrativeMetadataURI(
        uint256 loreIdx,
        string memory newLoreMetadataURI
    ) public {
        require(
            owner() == _msgSender(),
            'Ownable: caller is not the Lore Master'
        );
        narrative[loreIdx].loreMetadataURI = newLoreMetadataURI;
        emit NarrativeUpdated(loreIdx);
    }

    function addLore(
        uint256 wizardId,
        uint256 parentLoreId,
        bool nsfw,
        string memory loreMetadataURI
    ) public {
        address wizardOwner = IERC721(wizardsContractAddress).ownerOf(wizardId);
        require(
            wizardOwner == _msgSender(),
            'Owner: caller is not the Wizard owner'
        );
        wizardLore[wizardId].push(
            Lore(_msgSender(), parentLoreId, nsfw, false, loreMetadataURI)
        );
        emit LoreAdded(wizardId, wizardLore[wizardId].length - 1);
    }

    function addLoreWithSignature(
        bytes memory signature,
        uint256 wizardId,
        uint256 loreId,
        uint256 parentLoreId,
        bool nsfw,
        string memory loreMetadataURI
    ) public {
        // construct an expected hash, given the parameters
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        'AddLore(uint256 wizardId,uint256 loreId,uint256 parentLoreId,bool nsfw,string loreMetadataURI)'
                    ),
                    wizardId,
                    loreId, // acts as nonce
                    parentLoreId,
                    nsfw,
                    keccak256(bytes(loreMetadataURI)) // tricky!
                )
            )
        );

        // now recover the signer from the provided signature
        address signer = ECDSA.recover(digest, signature);

        // make sure the recover extracted a signer, but beware, because this
        // can return non-zero for some invalid cases (apparently?)
        require(signer != address(0), 'ECDSA: invalid signature');

        // get the owner of this wizard
        address wizardOwner = IERC721(wizardsContractAddress).ownerOf(wizardId);

        require(
            signer == wizardOwner,
            'addLoreWithSignature: signature is not the current Wizard owner'
        );

        require(
            numLore(wizardId) == loreId,
            'addLoreWithSignature: loreId is stale'
        );

        wizardLore[wizardId].push(
            Lore(signer, parentLoreId, nsfw, false, loreMetadataURI)
        );
        emit LoreAdded(wizardId, wizardLore[wizardId].length - 1);
    }

    function updateLoreMetadataURI(
        uint256 wizardId,
        uint256 loreIdx,
        string memory newLoreMetadataURI
    ) public {
        // is lore creator
        require(
            wizardLore[wizardId][loreIdx].creator == _msgSender(),
            'Owner: caller is not the Lore creator'
        );

        // holds wizard currently
        address wizardOwner = IERC721(wizardsContractAddress).ownerOf(wizardId);
        require(
            wizardOwner == _msgSender(),
            'Owner: caller is not the Wizard owner'
        );

        wizardLore[wizardId][loreIdx].loreMetadataURI = newLoreMetadataURI;

        emit LoreUpdated(wizardId, loreIdx);
    }

    function updateLoreNSFW(
        uint256 wizardId,
        uint256 loreIdx,
        bool newNSFW
    ) public {
        address wizardOwner = IERC721(wizardsContractAddress).ownerOf(wizardId);

        require(
            (wizardLore[wizardId][loreIdx].creator == _msgSender() &&
                wizardOwner == _msgSender()) || (owner() == _msgSender()),
            'Owner: caller is neither the Lore creator nor the Lore Master'
        );

        wizardLore[wizardId][loreIdx].nsfw = newNSFW;

        emit LoreUpdated(wizardId, loreIdx);
    }

    function strikeLore(
        uint256 wizardId,
        uint256 loreIdx,
        bool newStruck
    ) public {
        address wizardOwner = IERC721(wizardsContractAddress).ownerOf(wizardId);

        require(
            (wizardLore[wizardId][loreIdx].creator == _msgSender() &&
                wizardOwner == _msgSender()) || (owner() == _msgSender()),
            'Owner: caller is neither the Lore creator nor the Lore Master'
        );

        wizardLore[wizardId][loreIdx].struck = newStruck;

        emit LoreStruck(wizardId, loreIdx);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
